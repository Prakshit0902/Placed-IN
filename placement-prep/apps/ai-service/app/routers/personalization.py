from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.config import settings
from app.core.llm import personalize_template_gemini
from app.core.supabase import get_supabase
from datetime import datetime, timezone

router = APIRouter()
security = HTTPBearer()

def verify_internal_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    if credentials.credentials != settings.INTERNAL_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal service key")
    return credentials.credentials

class PersonalizeRequest(BaseModel):
    user_id: str
    leetcode_username: str
    company: str
    duration_days: int

@router.post("/")
async def generate_personalized_sheet(req: PersonalizeRequest, token: str = Depends(verify_internal_key)):
    supabase = get_supabase()
    
    # 1. Fetch base template
    template_id = f"{req.company.lower().replace(' ', '_')}_sde_{req.duration_days}day"
    res = supabase.table("prep_templates").select("*").eq("id", template_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Base template not found for the requested company and duration")
        
    base_template = res.data[0]
    
    # 2. Call LeetCode Parse (import directly to avoid self-calling HTTP)
    try:
        from app.routers.leetcode import parse_leetcode_profile, ProfileRequest
        profile_req = ProfileRequest(username=req.leetcode_username)
        student_profile = await parse_leetcode_profile(profile_req)
    except HTTPException:
        raise  # re-raise HTTP exceptions as-is (e.g. 404 user not found)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch LeetCode profile: {str(e)}")

    # 3. Call LLM to personalize
    try:
        personalized_data = personalize_template_gemini(
            base_template=base_template.get("template_data", {}),
            student_profile=student_profile,
            duration_days=req.duration_days
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate personalization: {str(e)}")
        
    # 4. Store in personalized_sheets table (let Supabase generate the UUID)
    now = datetime.now(timezone.utc).isoformat()
    
    sheet_record = {
        "user_id": req.user_id,
        "company": req.company,
        "role": "SDE",
        "duration_days": req.duration_days,
        "leetcode_username": req.leetcode_username,
        "original_template_id": base_template["id"],
        "personalized_data": personalized_data,
        "leetcode_profile_snapshot": student_profile,
        "adjustments_made": personalized_data.get("adjustments_made", []),
        "completion_status": "not_started",
        "created_at": now,
        "updated_at": now
    }
    
    insert_res = supabase.table("personalized_sheets").insert(sheet_record).execute()
    
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save personalized sheet to database")
        
    return {"success": True, "sheet": insert_res.data[0]}
