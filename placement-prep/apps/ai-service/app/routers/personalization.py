from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.core.llm import format_personalized_plan
from app.core.supabase import get_supabase
from app.core.recommendation.recommender import build_personalized_plan
from app.core.recommendation.user_model import UserSkillModel
from app.core.recommendation.pool import CompanyPool
from app.core.readiness import compute_readiness
import time
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
    mode: Optional[str] = "basic"


@router.post("/")
async def generate_personalized_sheet(
    req: PersonalizeRequest,
    token: str = Depends(verify_internal_key),
):
    supabase = get_supabase()
    mode = req.mode or "basic"

    # Validate template exists
    template_id = f"{req.company.lower().replace(' ', '_')}_sde_{req.duration_days}day"
    res = supabase.table("prep_templates").select("*").eq("id", template_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=404,
            detail="Base template not found for the requested company and duration",
        )
    base_template = res.data[0]

    # Fetch public LeetCode profile
    try:
        from app.routers.leetcode import parse_leetcode_profile, ProfileRequest
        profile_req = ProfileRequest(username=req.leetcode_username)
        student_profile = await parse_leetcode_profile(profile_req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch LeetCode profile: {str(e)}")

    # Load previous readiness snapshot for regeneration detection
    prev_readiness = None
    try:
        existing = (
            supabase.table("personalized_sheets")
            .select("readiness_score")
            .eq("user_id", req.user_id)
            .eq("company", req.company)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            prev_readiness = existing.data[0].get("readiness_score")
    except Exception:
        pass  # non-fatal

    try:
        t0 = time.time()

        # Step 1: Load company pool (join-only, no full table scan)
        loader = CompanyPool(supabase)
        loader.load(req.company)
        pool = loader.get_pool(req.company)
        required_topics = loader.required_topics(req.company)
        t1 = time.time()
        print(f"[TIMING] Pool load: {t1 - t0:.2f}s ({len(pool)} questions)")

        # Step 2: Build user model
        if mode == "deep":
            user_model = UserSkillModel.from_db(supabase, req.user_id, student_profile)
        else:
            user_model = UserSkillModel.from_profile_only(student_profile)
        t2 = time.time()
        print(
            f"[TIMING] User model load: {t2 - t1:.2f}s "
            f"(solved={len(user_model.solved_problem_ids)}, "
            f"attempted={len(user_model.attempted_problem_ids)}, "
            f"topic_profiles={len(user_model.topic_profiles)})"
        )

        # Step 3: Build plan
        plan = build_personalized_plan(
            supabase=supabase,
            company=req.company,
            duration_days=req.duration_days,
            mode=mode,
            user=user_model,
            pool=pool,
            required_topics=required_topics,
            profile=student_profile,
        )
        t3 = time.time()
        print(f"[TIMING] Plan build: {t3 - t2:.2f}s ({plan.total_questions} questions across {plan.total_weeks} weeks)")

        # Step 4: Compute readiness (reuses already-loaded pool — no extra DB call)
        readiness_score = compute_readiness(
            req.company, user_model, pool, previous_snapshot=prev_readiness
        )
        t4 = time.time()
        print(f"[TIMING] Readiness: {t4 - t3:.2f}s (overall={readiness_score['overall']}%)")

        # Step 5: Format plan (deterministic or LLM)
        weeks_skeleton = [
            {
                "week_number": w.week_number,
                "theme": w.theme,
                "questions": [q.to_dict() for q in w.questions],
                "metrics": w.metrics,
                "notes": w.notes,
            }
            for w in plan.weeks
        ]
        personalized_data = format_personalized_plan(
            weeks_skeleton=weeks_skeleton,
            student_profile=student_profile,
            duration_days=req.duration_days,
            deterministic_adjustments=plan.adjustments_summary,
            total_weeks=plan.total_weeks,
        )
        t5 = time.time()
        print(f"[TIMING] Format plan: {t5 - t4:.2f}s")
        print(f"[TIMING] Total: {t5 - t0:.2f}s")

        week_question_ids = [w.to_week_question_ids_entry() for w in plan.weeks]

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate personalization: {str(e)}")

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
        "adjustments_made": plan.adjustments_summary,  # use plan's adjustments, not LLM output
        "readiness_score": readiness_score,
        "plan_version": 3,  # bumped from v2 to mark the new engine
        "week_question_ids": week_question_ids,
        "completion_status": "not_started",
        "created_at": now,
        "updated_at": now,
    }

    insert_res = supabase.table("personalized_sheets").insert(sheet_record).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save personalized sheet to database")

    sheet = insert_res.data[0]
    sheet["readiness_score"] = readiness_score
    return {"success": True, "sheet": sheet}
