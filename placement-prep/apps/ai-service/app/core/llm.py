import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from app.config import settings

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

def personalize_template_gemini(
    base_template: Dict[str, Any], 
    student_profile: Dict[str, Any],
    duration_days: int
) -> Dict[str, Any]:
    """
    Uses Gemini Pro to modify a standard 30/60/90 day prep template based on a student's LeetCode profile.
    """
    prompt = f"""
    You are an expert technical interview coach. You are provided with a generic {duration_days}-day 
    interview preparation template and a student's current LeetCode profile.
    
    Student Profile:
    {json.dumps(student_profile, indent=2)}
    
    Base Template (Weeks):
    {json.dumps(base_template.get('weeks', []), indent=2)}
    
    Your task is to PERSONALIZE the Base Template based on the Student Profile:
    1. For the student's "strong_areas", reduce the number of Easy questions or replace them with Hard questions.
    2. For the student's "weak_areas", add more Easy/Medium questions and ensure those topics get extra focus.
    3. Retain the general weekly structure and ensure total estimated hours are realistic.
    4. Provide an 'adjustments_made' summary explaining what you changed and why.
    """

    try:
        # Use gemini-2.5-pro for more complex reasoning and reliable JSON generation
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=PersonalizedTemplate,
            )
        )
        
        parsed = PersonalizedTemplate.model_validate_json(response.text)
        return parsed.model_dump()
    except Exception as e:
        print(f"Error personalizing template with Gemini: {e}")
        return {
            "weeks": base_template.get("weeks", []),
            "adjustments_made": [f"Failed to generate personalization: {str(e)}"]
        }
