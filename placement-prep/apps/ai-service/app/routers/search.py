from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.llm import extract_filters_gemini
from app.core.embeddings import embed_query
from app.core.qdrant import semantic_search
from app.core.supabase import get_supabase
from google import genai
from google.genai import types
from app.config import settings

router = APIRouter()
client = genai.Client(api_key=settings.GEMINI_API_KEY)

POPULAR_LANGUAGES = ["python", "java", "cpp", "javascript", "typescript", "go", "rust"]


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


class QueryExpansion(BaseModel):
    expansions: list[str]


def _expand_query(query: str) -> list[str]:
    """
    Uses Gemini to generate 2-3 semantic rephrasing/expansions of the user query.
    This enables multi-vector search that catches more contextually relevant results.
    Falls back to original query only on error.
    """
    try:
        prompt = f"""
You are a semantic search expert for LeetCode problems.
Generate 2-3 concise semantic rephrasing/expansions for this query to improve retrieval.
Each expansion should use different terminology or framing but represent the same intent.
Do NOT add unrelated concepts.

Query: "{query}"

Return a QueryExpansion JSON with an "expansions" array of 2-3 strings.
"""
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QueryExpansion,
            ),
        )
        result = QueryExpansion.model_validate_json(response.text)
        # Combine original with expansions; deduplicate
        all_queries = [query] + [e for e in result.expansions if e.lower() != query.lower()]
        return all_queries[:4]  # max 4 queries total
    except Exception:
        return [query]


@router.post("/")
async def search_problems(req: SearchRequest):
    query_text = req.query

    # 1. Extract filters using Gemini Flash
    filters = extract_filters_gemini(query_text)

    topic_filters = filters.get("topics", [])
    difficulty_filter = filters.get("difficulty")
    company_filter = filters.get("company")

    # 2. Expand query semantically for richer retrieval
    all_queries = _expand_query(query_text)

    # 3. Embed all query variants and run Qdrant search for each
    seen_ids: set[int] = set()
    merged_results: list[dict] = []

    for q in all_queries:
        vector = embed_query(q)
        results = await semantic_search(
            query_vector=vector,
            topic_filters=topic_filters,
            difficulty=difficulty_filter,
            limit=req.limit * 2,
        )
        for r in results:
            pid = r["id"]
            if pid not in seen_ids:
                seen_ids.add(pid)
                merged_results.append(r)

    if not merged_results:
        return {"results": [], "filters_extracted": filters, "query_expansions": all_queries[1:]}

    problem_ids = [p["id"] for p in merged_results]

    # 4. Fetch frequency from Supabase for re-ranking
    supabase = get_supabase()

    freq_map: dict[int, float] = {}
    if company_filter:
        res = supabase.table("lc_company_questions")\
            .select("problem_id, frequency")\
            .in_("problem_id", problem_ids)\
            .ilike("company", company_filter)\
            .execute()
    else:
        res = supabase.table("lc_company_questions")\
            .select("problem_id, frequency")\
            .in_("problem_id", problem_ids)\
            .execute()

    if res.data:
        for r in res.data:
            pid = r["problem_id"]
            freq = r.get("frequency") or 0
            if pid not in freq_map or freq > freq_map[pid]:
                freq_map[pid] = freq

    # 5. Re-rank by semantic score + frequency signal
    for p in merged_results:
        pid = p["id"]
        freq = freq_map.get(pid, 0)
        p["frequency"] = freq
        p["combined_score"] = p["score"] + (min(freq, 100) / 100.0) * 0.2

    merged_results.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
    top_results = merged_results[:req.limit]

    # 6. Fetch language availability badges for each result
    if top_results:
        top_ids = [p["id"] for p in top_results]
        lang_res = supabase.table("lc_problem_solutions")\
            .select("problem_id, language")\
            .in_("problem_id", top_ids)\
            .in_("language", POPULAR_LANGUAGES)\
            .execute()

        lang_map: dict[int, list[str]] = {}
        for row in (lang_res.data or []):
            pid = row["problem_id"]
            lang_map.setdefault(pid, []).append(row["language"])

        for p in top_results:
            p["available_languages"] = lang_map.get(p["id"], [])

    return {
        "results": top_results,
        "filters_extracted": filters,
        "query_expansions": all_queries[1:],  # expose expansions for UI debugging
    }
