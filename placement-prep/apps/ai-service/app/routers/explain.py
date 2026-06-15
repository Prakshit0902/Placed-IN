"""
explain.py — AI-powered problem explanation, hint, and complexity endpoints.
Mounted at /api/query/explain in main.py.
All routes are protected by INTERNAL_SERVICE_KEY (called only from Node API gateway).
"""
import json
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional
from google import genai
from app.config import settings
from app.core.supabase import get_supabase
from app.core.llm import generate_json
try:
    from curl_cffi import requests as cf_requests
except ImportError:
    import requests as cf_requests
import requests
import re
from functools import lru_cache

router = APIRouter()
security = HTTPBearer()
client = genai.Client(api_key=settings.GEMINI_API_KEY)


# ── Auth guard ────────────────────────────────────────────────────────────────

def verify_internal_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    if credentials.credentials != settings.INTERNAL_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal service key")
    return credentials.credentials


# ── Pydantic response models ──────────────────────────────────────────────────

class DryRunStep(BaseModel):
    iteration: str = Field(description="Iteration or step label, e.g. 'i=0', 'Pass 1'")
    state: str = Field(description="Relevant variable values at this step as compact JSON or table")
    action: str = Field(description="What operation happened this step")

class ExplanationResponse(BaseModel):
    analogy: str = Field(description="A relatable real-world analogy that explains the algorithm's core intuition in 2-4 sentences")
    approach_steps: list[str] = Field(description="Numbered step-by-step algorithm walkthrough, language-agnostic, 4-8 steps")
    dry_run: list[DryRunStep] = Field(description="Step-by-step trace of the algorithm on the first sample test case, 4-8 steps")
    code: str = Field(description="Clean, well-commented solution code in the requested language")
    time_complexity: str = Field(description="Big-O time complexity with brief justification")
    space_complexity: str = Field(description="Big-O space complexity with brief justification")
    code_source: str = Field(description="One of: 'database', 'llm_generated', 'llm_translated'")

class HintResponse(BaseModel):
    hint: str = Field(description="The hint text appropriate for the requested level")
    level: int
    is_final_hint: bool = Field(description="True if this is the last hint level (level 3)")

class AlternativeApproach(BaseModel):
    name: str = Field(description="Name of the alternative approach")
    time_complexity: str
    space_complexity: str
    tradeoff: str = Field(description="Why you would or would not prefer this over the main solution")

class ComplexityAnalysis(BaseModel):
    time_complexity: str = Field(description="Overall Big-O time complexity")
    space_complexity: str = Field(description="Overall Big-O space complexity")
    line_by_line: list[str] = Field(description="Key lines or blocks with their individual complexity contributions")
    is_optimal: bool = Field(description="True if this is the theoretically optimal complexity for this problem")
    alternatives: list[AlternativeApproach] = Field(description="1-2 alternative approaches with tradeoffs")

class SimilarProblemsResponse(BaseModel):
    problems: list[str] = Field(description="List of 4-5 LeetCode problem slugs (e.g. 'two-sum', 'three-sum') that are semantically similar or build on the same concepts, ordered by recommended study order")
    reasoning: str = Field(description="1-2 sentence explanation of why these problems are recommended next")

class CodeResponse(BaseModel):
    code: str = Field(description="Clean, well-commented solution code in the requested language")
    code_source: str = Field(description="One of: 'database', 'llm_generated', 'llm_translated'")


# ── Request bodies ────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    problem_id: str
    language: str = "python"
    platform: str = "leetcode"
    extension_code: Optional[str] = None
    extension_language: Optional[str] = None
    tier: str = "free"

class HintRequest(BaseModel):
    problem_id: str
    level: int = Field(ge=1, le=3, description="Hint level: 1=vague, 2=specific insight, 3=near-pseudocode")
    platform: str = "leetcode"
    tier: str = "free"

class ComplexityRequest(BaseModel):
    problem_id: str
    language: str = "python"
    platform: str = "leetcode"
    tier: str = "free"

class SimilarRequest(BaseModel):
    problem_id: str
    platform: str = "leetcode"
    tier: str = "free"


# ── Helper: fetch problem and solution from Supabase or CF ────────────────────

@lru_cache(maxsize=1000)
def _fetch_cf_submission_code(problem_id: str) -> Optional[str]:
    match = re.match(r"^(\d+)([A-Za-z]+)$", str(problem_id))
    if not match:
        return None
    contest_id, index = match.groups()
    try:
        url = f"https://codeforces.com/api/contest.status?contestId={contest_id}&from=1&count=200"
        resp = requests.get(url, timeout=5)
        data = resp.json()
        if data.get("status") != "OK": return None
        sub_id = None
        for s in data["result"]:
            if s.get("verdict") == "OK" and s["problem"]["index"] == index and "C++" in s.get("programmingLanguage", ""):
                sub_id = s["id"]
                break
        if not sub_id: return None
        sub_url = f"https://codeforces.com/contest/{contest_id}/submission/{sub_id}"
        kwargs = {"timeout": 5}
        if getattr(cf_requests, "__name__", "") == "curl_cffi.requests":
            kwargs["impersonate"] = "chrome110"
        html = cf_requests.get(sub_url, **kwargs).text
        code_match = re.search(r'<pre id="program-source-text"[^>]*>(.*?)</pre>', html, re.DOTALL)
        if code_match:
            import html as htmllib
            return htmllib.unescape(code_match.group(1)).strip()
    except Exception as e:
        print("CF Scrape error:", e)
    return None

def _fetch_problem(problem_id: str, platform: str = "leetcode") -> dict:
    """Returns lc_problems row or mock CF problem."""
    if platform == "codeforces":
        return {
            "id": problem_id,
            "title": f"Codeforces {problem_id}",
            "difficulty": "Unknown",
            "content": f"[Problem description not available. If no base code is provided, please generate the optimal C++ solution and explain the problem for Codeforces {problem_id} from your pre-trained knowledge.]",
            "topic_tags": [],
            "hints": [],
            "example_testcases": "",
            "slug": problem_id
        }
    sb = get_supabase()
    res = sb.table("lc_problems").select("id, title, slug, difficulty, content, topic_tags, hints, example_testcases").eq("id", int(problem_id)).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Problem {problem_id} not found")
    return res.data[0]

def _fetch_solution(problem_id: str, language: str, platform: str = "leetcode", extension_code: Optional[str] = None, extension_language: Optional[str] = None) -> tuple[Optional[str], str]:
    """Returns (code string, source) if found, else (None, "")"""
    sb = get_supabase()
    if platform == "codeforces":
        res = sb.table("cf_problem_solutions").select("code").eq("problem_id", problem_id).eq("language", language).limit(1).execute()
        if res.data:
            return (res.data[0]["code"], "database")

        # Map extension_language back to standardized language names if necessary
        ext_lang_lower = (extension_language or "").lower()
        if ext_lang_lower in ["c++", "cpp"]: ext_lang_lower = "cpp"
        elif ext_lang_lower == "python": ext_lang_lower = "python"
        elif ext_lang_lower == "java": ext_lang_lower = "java"
        else: ext_lang_lower = "unknown"

        # If the scraped language matches the requested language, return it directly!
        if extension_code and ext_lang_lower == language:
            return (extension_code, "scraped_cf")
            
        if language in ["cpp", "c++"]:
            code = _fetch_cf_submission_code(problem_id)
            if code: return (code, "scraped_cf")
        return (None, "")
        
    res = sb.table("lc_problem_solutions").select("code").eq("problem_id", int(problem_id)).eq("language", language).limit(1).execute()
    return (res.data[0]["code"], "database") if res.data else (None, "")

def _fetch_any_solution(problem_id: str, platform: str = "leetcode", extension_code: Optional[str] = None, extension_language: Optional[str] = None) -> Optional[tuple[str, str]]:
    """Returns (language, code) for the first available solution in any language, or None."""
    sb = get_supabase()
    preferred = ["python", "java", "cpp", "javascript", "typescript", "go"]
    if platform == "codeforces":
        for lang in preferred:
            res = sb.table("cf_problem_solutions").select("code").eq("problem_id", problem_id).eq("language", lang).limit(1).execute()
            if res.data:
                return (lang, res.data[0]["code"])
        res = sb.table("cf_problem_solutions").select("language, code").eq("problem_id", problem_id).limit(1).execute()
        if res.data:
            return (res.data[0]["language"], res.data[0]["code"])
            
        if extension_code: 
            ext_lang_lower = (extension_language or "").lower()
            if ext_lang_lower in ["c++", "cpp"]: ext_lang_lower = "cpp"
            elif ext_lang_lower == "python": ext_lang_lower = "python"
            elif ext_lang_lower == "java": ext_lang_lower = "java"
            else: ext_lang_lower = "cpp" # Fallback assumption
            return (ext_lang_lower, extension_code)
        cf_code = _fetch_cf_submission_code(problem_id)
        if cf_code: return ("cpp", cf_code)
        return None
        
    for lang in preferred:
        res = sb.table("lc_problem_solutions").select("code").eq("problem_id", int(problem_id)).eq("language", lang).limit(1).execute()
        if res.data:
            return (lang, res.data[0]["code"])
    res = sb.table("lc_problem_solutions").select("language, code").eq("problem_id", int(problem_id)).limit(1).execute()
    if res.data:
        return (res.data[0]["language"], res.data[0]["code"])
    return None

def _upsert_solution(problem_id: str, language: str, platform: str, code: str):
    sb = get_supabase()
    try:
        if platform == "leetcode":
            sb.table("lc_problem_solutions").upsert({
                "problem_id": int(problem_id),
                "language": language,
                "code": code
            }, on_conflict="problem_id,language").execute()
        elif platform == "codeforces":
            sb.table("cf_problem_solutions").upsert({
                "problem_id": problem_id,
                "language": language,
                "code": code
            }, on_conflict="problem_id,language").execute()
    except Exception as e:
        print(f"Failed to upsert solution: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/code", response_model=CodeResponse)
async def get_code(req: ExplainRequest, _: str = Depends(verify_internal_key)):
    """
    Fast endpoint to fetch just the solution code. Returns instantly if in DB,
    otherwise uses LLM to translate or generate it.
    """
    code, source = _fetch_solution(req.problem_id, req.language, req.platform, req.extension_code, req.extension_language)
    if code:
        if source == "scraped_cf":
            _upsert_solution(req.problem_id, req.language, req.platform, code)
        return CodeResponse(code=code, code_source=source)
        
    problem = _fetch_problem(req.problem_id, req.platform)
    base = _fetch_any_solution(req.problem_id, req.platform, req.extension_code, req.extension_language)
    topic_str = ", ".join(problem.get("topic_tags") or [])
    
    prompt = f"""
You are an expert software engineer. Write a clean, optimal, well-commented solution in **{req.language}** for this LeetCode problem:

**Problem #{problem['id']}: {problem['title']}** ({problem['difficulty']})
Topics: {topic_str}

Problem Description:
{(problem.get('content') or '')[:2000]}

"""

    if base:
        base_lang, base_code = base
        code_source = "llm_translated"
        prompt += f"""
Here is a working solution in **{base_lang}** to use as reference context to ensure the logic and approach are optimal and correct:
```{base_lang}
{base_code}
```
Please translate this exact logic into idiomatic **{req.language}**. Make sure you follow the expected class and method signatures from the problem description.
"""
    else:
        code_source = "llm_generated"
        prompt += f"""
Generate the optimal solution in **{req.language}** from scratch.
"""

    prompt += f"""
IMPORTANT FORMATTING INSTRUCTIONS:
- The output code MUST be formatted as a proper multiline string with standard newline characters (`\\n`) and correct indentation. Do NOT compress it into a single line.
- Provide inline comments explaining the key steps.
- The returned JSON must match the CodeResponse schema, containing:
  1. `code`: The complete, readable multiline code string.
  2. `code_source`: Exactly "{code_source}".
"""
    
    try:
        result = generate_json(prompt, CodeResponse, req.tier)
        result.code_source = code_source
        _upsert_solution(req.problem_id, req.language, req.platform, result.code)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM code generation failed: {e}")

@router.post("/solution", response_model=ExplanationResponse)
async def explain_solution(req: ExplainRequest, _: str = Depends(verify_internal_key)):
    """
    Main explanation endpoint. Returns a full structured breakdown:
    analogy, step-by-step approach, dry run trace, and code in the requested language.
    Serves solution from DB if available, otherwise translates or generates via Gemini.
    """
    problem = _fetch_problem(req.problem_id, req.platform)
    
    # --- Determine code source ---
    code, source = _fetch_solution(req.problem_id, req.language, req.platform, req.extension_code, req.extension_language)
    if code:
        if source == "scraped_cf":
            _upsert_solution(req.problem_id, req.language, req.platform, code)
        return ExplanationResponse(
            analogy="Solution found in verified database." if source == "database" else "Solution successfully scraped from Codeforces submissions.",
            approach_steps=["Understand the problem requirements.", "Analyze the optimal time and space complexities.", "Implement the verified solution code."],
            dry_run=[],
            code=code,
            time_complexity="O(N) (Estimated)",
            space_complexity="O(N) (Estimated)",
            code_source=source
        )

    # Try to find any existing solution to translate from
    base = _fetch_any_solution(req.problem_id, req.platform, req.extension_code, req.extension_language)
    if base:
        base_lang, base_code = base
        code_source = "llm_translated"
        translate_context = f"""
A solution in {base_lang} already exists. Translate it idiomatically to {req.language}:
```{base_lang}
{base_code}
```
"""
    else:
        code_source = "llm_generated"
        translate_context = f"No existing solution is available. Generate an optimal solution from scratch in {req.language}."

    topic_str = ", ".join(problem.get("topic_tags") or [])
    hints_str = "\n".join(f"- {h}" for h in (problem.get("hints") or []))
    test_cases = problem.get("example_testcases") or ""

    prompt = f"""
You are an expert coding interview coach. Produce a complete explanation for the following LeetCode problem.

**Problem #{problem['id']}: {problem['title']}** ({problem['difficulty']})
Topics: {topic_str}

Problem Description (HTML):
{(problem.get('content') or '')[:3000]}

Sample test cases:
{test_cases[:500]}

Hints from LeetCode:
{hints_str}

Target language: **{req.language}**
{translate_context}

{"Existing code to use as-is:" if code_source == "database" else ""}
{f"```{req.language}\\n{code}\\n```" if code_source == "database" and code else ""}

Produce:
1. analogy: A vivid, relatable real-world analogy (2-4 sentences) that captures the core algorithmic intuition
2. approach_steps: 5-8 numbered language-agnostic algorithm steps
3. dry_run: Step-by-step variable trace on the first sample test case (4-8 steps)
4. code: Clean solution in {req.language} with inline comments explaining each block. IMPORTANT: The code MUST be a proper multiline string with standard newline characters (`\\n`) and correct indentation. Do NOT compress it into a single line.
5. time_complexity + space_complexity: Big-O with justification
6. code_source: exactly "{code_source}"
"""

    try:
        result = generate_json(prompt, ExplanationResponse, req.tier)
        result.code_source = code_source
        _upsert_solution(req.problem_id, req.language, req.platform, result.code)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM explanation failed: {e}")


@router.post("/hints", response_model=HintResponse)
async def get_hints(req: HintRequest, _: str = Depends(verify_internal_key)):
    """
    Progressive hint system. Levels 1 & 2 are free; level 3 is premium-gated upstream.
    Level 1: vague direction. Level 2: key insight. Level 3: near-pseudocode.
    """
    problem = _fetch_problem(req.problem_id, req.platform)
    topic_str = ", ".join(problem.get("topic_tags") or [])
    
    level_instructions = {
        1: "Give a high-level nudge pointing the user toward the right data structure or algorithm family. Do NOT reveal the approach. Ask a guiding question. Max 2 sentences.",
        2: "Reveal the key algorithmic insight (e.g. 'think about complement lookup in O(1)'). Still no code or pseudocode. Max 3 sentences.",
        3: "Provide near-pseudocode that outlines the complete algorithm step by step without actual implementation syntax. The user should be able to code it from this. 4-8 bullet points.",
    }

    prompt = f"""
You are a coding mentor giving a Level {req.level} hint for this LeetCode problem.

Problem: {problem['title']} ({problem['difficulty']})
Topics: {topic_str}
Description: {(problem.get('content') or '')[:1500]}

Hint level instructions: {level_instructions[req.level]}

Respond with a HintResponse JSON with fields: hint (string), level ({req.level}), is_final_hint ({str(req.level == 3).lower()}).
"""

    try:
        result = generate_json(prompt, HintResponse, req.tier)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM hint generation failed: {e}")


@router.post("/complexity", response_model=ComplexityAnalysis)
async def analyze_complexity(req: ComplexityRequest, _: str = Depends(verify_internal_key)):
    """
    Deep complexity analysis: overall Big-O, line-by-line breakdown,
    optimality verdict, and 1-2 alternative approaches with tradeoffs.
    """
    problem = _fetch_problem(req.problem_id, req.platform)

    # Get solution code (from DB or generate minimal version)
    code_result = _fetch_solution(req.problem_id, req.language, req.platform)
    code = code_result[0]
    if not code:
        base = _fetch_any_solution(req.problem_id, req.platform)
        code = base[1] if base else "[No solution available — analyze based on problem description]"

    prompt = f"""
You are a senior algorithms engineer performing a complexity audit.

Problem: {problem['title']} ({problem['difficulty']})
Language: {req.language}

Solution code:
```{req.language}
{code[:3000]}
```

Produce a ComplexityAnalysis with:
- time_complexity: Overall Big-O (e.g. "O(n)")
- space_complexity: Overall Big-O space
- line_by_line: List of 3-6 strings each noting a key code block and its complexity contribution (e.g. "hash map lookup in loop → O(1) per iteration, O(n) total")
- is_optimal: True/false whether this is the best possible complexity for this problem class
- alternatives: 1-2 alternative approaches with name, time/space complexity, and tradeoff analysis
"""

    try:
        result = generate_json(prompt, ComplexityAnalysis, req.tier)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM complexity analysis failed: {e}")


@router.post("/similar", response_model=SimilarProblemsResponse)
async def get_similar_problems(req: SimilarRequest, _: str = Depends(verify_internal_key)):
    """
    Recommends 4-5 follow-up problems based on the current problem's topics and difficulty,
    ordered by natural learning progression.
    """
    problem = _fetch_problem(req.problem_id, req.platform)
    topic_str = ", ".join(problem.get("topic_tags") or [])

    # Fetch all available problem slugs from DB for grounding the LLM
    sb = get_supabase()
    slugs_res = sb.table("lc_problems").select("slug, title, difficulty, topic_tags").execute()
    # Sample 200 problems with overlapping topics to keep prompt concise
    candidate_problems = [
        p for p in (slugs_res.data or [])
        if any(t in (p.get("topic_tags") or []) for t in (problem.get("topic_tags") or []))
        and p["slug"] != problem["slug"]
    ][:200]

    candidates_str = "\n".join(
        f"- {p['slug']} ({p['difficulty']}, topics: {', '.join(p.get('topic_tags') or [])})"
        for p in candidate_problems[:100]
    )

    prompt = f"""
You are a coding interview curriculum designer.

A student just studied: **{problem['title']}** ({problem['difficulty']}, topics: {topic_str})

From the following available problems, choose 4-5 that form a natural learning progression.
Prefer problems that:
1. Reinforce the same core technique at slightly higher complexity
2. Introduce the next logical extension (e.g. Two Sum → Three Sum → K-Sum)
3. Apply the same data structure in a different context

Available problems:
{candidates_str}

Return a SimilarProblemsResponse with:
- problems: list of 4-5 slugs ordered from easiest/most-similar to hardest/most-advanced
- reasoning: 1-2 sentences explaining the learning path
"""

    try:
        result = generate_json(prompt, SimilarProblemsResponse, req.tier)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM similar problems failed: {e}")
 
