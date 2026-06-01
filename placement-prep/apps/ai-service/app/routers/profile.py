from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.config import settings
from app.core.supabase import get_supabase
from app.core.recommendation.profile_builder import build_topic_profiles
from app.core.logger import logger

router = APIRouter()
security = HTTPBearer()

def verify_internal_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    if credentials.credentials != settings.INTERNAL_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal service key")
    return credentials.credentials

class RebuildProfileRequest(BaseModel):
    user_id: str

@router.post("/rebuild")
async def rebuild_profile(req: RebuildProfileRequest, token: str = Depends(verify_internal_key)):
    supabase = get_supabase()
    try:
        profiles = build_topic_profiles(supabase, req.user_id)
        return {"success": True, "count": len(profiles)}
    except Exception as e:
        logger.error(f"Failed to rebuild profile for {req.user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to rebuild profile: {str(e)}")
