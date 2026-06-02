import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from app.config import settings
from app.core.plan_validator import deterministic_weeks_from_plan, validate_personalized_output

# Initialize the new google-genai SDK client
client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Initialize Groq client
import groq
groq_client = None
if settings.GROQ_API_KEY:
    groq_client = groq.Groq(api_key=settings.GROQ_API_KEY)

def generate_json(prompt: str, schema_class: type[BaseModel], tier: str = "free", groq_model: str = "llama-3.1-8b-instant", gemini_model: str = "gemini-3.1-flash-lite") -> BaseModel:
    """
    Generates structured JSON using Groq for 'free' tier and Gemini for 'premium' tier.
    """
    if tier == "free" and groq_client:
        try:
            # Groq Llama 3 requires json_object format and the prompt MUST tell it to output JSON
            prompt_with_instructions = prompt + f"\n\nIMPORTANT: Output ONLY valid JSON matching this schema:\n{schema_class.model_json_schema()}"
            
            completion = groq_client.chat.completions.create(
                model=groq_model,
                messages=[
                    {"role": "system", "content": "You are an expert AI assistant. You must respond in valid JSON format."},
                    {"role": "user", "content": prompt_with_instructions}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            return schema_class.model_validate_json(completion.choices[0].message.content)
        except Exception as e:
            print(f"Groq generation failed: {e}. Falling back to Gemini.")
            # Fallback to Gemini if Groq fails
            pass
            
    # Gemini path (premium or fallback)
    response = client.models.generate_content(
        model=gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
            response_schema=schema_class,
        )
    )
    return schema_class.model_validate_json(response.text)


class SearchFilters(BaseModel):
    company: Optional[str] = Field(None, description="The target company (e.g. Amazon, Google, Microsoft)")
    topics: Optional[List[str]] = Field(None, description="LeetCode topic tags (e.g. ['array', 'dynamic-programming', 'graph'])")
    difficulty: Optional[str] = Field(None, description="One of 'Easy', 'Medium', 'Hard'")
    duration_days: Optional[int] = Field(None, description="Target prep duration in days (e.g. 30, 60, 90)")

class WeekMetrics(BaseModel):
    easy: int
    medium: int
    hard: int
    estimated_hours: float
    total: int

class WeekQuestion(BaseModel):
    id: int
    title: str
    slug: str
    difficulty: str

class PersonalizedWeek(BaseModel):
    week: int
    theme: str
    questions: List[WeekQuestion]
    metrics: WeekMetrics

class PersonalizedTemplate(BaseModel):
    weeks: List[PersonalizedWeek]
    adjustments_made: List[str] = Field(description="Summary of changes made based on student profile")

def extract_filters_gemini(query: str) -> Dict[str, Any]:
    """
    Uses Gemini Flash to extract structured filters from a natural language query.
    Returns a dict with: company, topics, difficulty, duration_days
    """
    prompt = f"""
    You are an AI assistant that extracts search filters from a user's natural language query for LeetCode interview prep.
    Extract the relevant fields based on the user's intent. If a field is not mentioned, omit it.

    User Query: "{query}"
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=SearchFilters,
            )
        )
        
        # Parse into a generic dict excluding unset values to match our router's expectations
        parsed = SearchFilters.model_validate_json(response.text)
        return parsed.model_dump(exclude_none=True)
    except Exception as e:
        print(f"Error extracting filters with Gemini: {e}")
        return {}

def format_personalized_plan(
    weeks_skeleton: List[Dict[str, Any]],
    student_profile: Dict[str, Any],
    duration_days: int,
    deterministic_adjustments: List[str],
    total_weeks: int,
) -> Dict[str, Any]:
    """
    LLM formats a pre-selected question list into weekly themes and motivational copy.
    Questions are fixed; the model must NOT add or remove question IDs.
    """
    allowed_ids = set()
    for w in weeks_skeleton:
        for q in w.get("questions", []):
            allowed_ids.add(q["id"])

    compact_questions = []
    for w in weeks_skeleton:
        for q in w.get("questions", []):
            compact_questions.append({
                "id": q["id"],
                "title": q["title"],
                "slug": q["slug"],
                "difficulty": q["difficulty"],
                "week_number": w["week_number"],
            })

    import os
    if not os.environ.get("PERSONALIZE_USE_LLM", "").lower() in ("true", "1", "yes"):
        return {
            "weeks": deterministic_weeks_from_plan(weeks_skeleton, allowed_ids),
            "adjustments_made": deterministic_adjustments,
        }

    prompt = f"""
    You are an expert technical interview coach formatting a {duration_days}-day prep plan.

    FIXED QUESTION LIST (you MUST use ONLY these questions — same ids, no additions, no removals):
    {json.dumps(compact_questions, indent=2)}

    Week skeleton (assign each question to exactly its week_number; you may refine theme strings only):
    {json.dumps([{"week": w["week_number"], "theme": w.get("theme"), "question_ids": [q["id"] for q in w.get("questions", [])]} for w in weeks_skeleton], indent=2)}

    Rules:
    1. Output exactly {total_weeks} weeks.
    2. Every question id from the fixed list must appear exactly once across all weeks.
    3. Do NOT invent new questions or change ids/titles/slugs/difficulty.
    4. Write engaging week themes and include adjustments_made explaining the schedule (deterministic engine already selected questions).
    5. Compute metrics per week (easy/medium/hard counts, total, estimated_hours).
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=PersonalizedTemplate,
            ),
        )
        parsed = PersonalizedTemplate.model_validate_json(response.text)
        result = parsed.model_dump()
        if validate_personalized_output(result, allowed_ids, total_weeks):
            merged_adjustments = list(deterministic_adjustments)
            for item in result.get("adjustments_made") or []:
                if item not in merged_adjustments:
                    merged_adjustments.append(item)
            result["adjustments_made"] = merged_adjustments
            return result
    except Exception as e:
        print(f"LLM format failed, using deterministic layout: {e}")

    return {
        "weeks": deterministic_weeks_from_plan(weeks_skeleton, allowed_ids),
        "adjustments_made": deterministic_adjustments,
    }


def personalize_template_gemini_basic(
    base_template: Dict[str, Any],
    student_profile: Dict[str, Any],
    duration_days: int,
) -> Dict[str, Any]:
    """Deprecated: use format_personalized_plan with recommender output."""
    return format_personalized_plan(
        weeks_skeleton=base_template.get("weeks", []),
        student_profile=student_profile,
        duration_days=duration_days,
        deterministic_adjustments=["Legacy basic path"],
        total_weeks=len(base_template.get("weeks", [])),
    )


def personalize_template_gemini_deep(
    base_template: Dict[str, Any],
    student_profile: Dict[str, Any],
    duration_days: int,
    solved_slugs: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Deprecated: use format_personalized_plan with recommender output."""
    if solved_slugs is None:
        solved_slugs = []
    return format_personalized_plan(
        weeks_skeleton=base_template.get("weeks", []),
        student_profile=student_profile,
        duration_days=duration_days,
        deterministic_adjustments=[f"Excluded {len(solved_slugs)} solved slugs (legacy)"],
        total_weeks=len(base_template.get("weeks", [])),
    )
