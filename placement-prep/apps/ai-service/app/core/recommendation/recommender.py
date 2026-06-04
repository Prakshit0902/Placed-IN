"""
recommender.py — Orchestrates the full plan generation pipeline.

Key improvements:
- adjustments_summary text correctly says "deprioritized" not "excluded"
- Adds ATTEMPTED revisit summary to adjustments
- Adds general fallback problems (labeled) when company pool is sparse (<30 Q)
- Sparse fallback pulls highest-frequency problems across all companies for
  the relevant topics, so weeks are never empty
- Passes weak_areas and required_topics consistently to selector
"""

from typing import Any

from supabase import Client

from app.core.recommendation.constants import (
    BEHAVIORAL_POOL,
    DURATION_CONFIG,
    OOPS_POOL,
    QUESTIONS_PER_WEEK_TARGET,
    SYSTEM_DESIGN_POOL,
)
from app.core.recommendation.models import QuestionRef, SelectedPlan, WeekSelection
from app.core.recommendation.pool import CompanyPool
from app.core.recommendation.selector import (
    compute_dsa_breakdown,
    compute_week_availability,
    estimate_hours,
    generate_notes,
    generate_theme,
    get_topic_availability,
    select_questions_for_week,
    synthetic_to_ref,
)
from app.core.recommendation.topic_scheduler import assign_topics_to_weeks_urgency
from app.core.recommendation.user_model import UserSkillModel
from app.core.logger import logger

# Minimum company questions before we blend in general-practice problems
SPARSE_COMPANY_THRESHOLD = 30


def _load_general_fallback_pool(
    supabase: Client,
    required_topics: set[str],
    existing_pool: list[dict],
    target_size: int = 100,
) -> list[dict]:
    """
    When the company pool is sparse, supplement with high-frequency problems
    from other companies for the required topics, clearly labeled as general practice.
    """
    from app.core.recommendation.constants import TAG_TO_TOPIC

    existing_ids = {cq["problem"]["id"] for cq in existing_pool}
    supplemental: list[dict] = []

    # Fetch top problems for required topics from any company
    limit = 500
    offset = 0
    while len(supplemental) < target_size:
        res = (
            supabase.table("lc_company_questions")
            .select("problem_id, frequency, windows")
            .order("frequency", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break

        problem_ids = [
            cq["problem_id"] for cq in res.data
            if cq["problem_id"] and cq["problem_id"] not in existing_ids
        ]
        if not problem_ids:
            offset += limit
            continue

        # Fetch problem details
        prob_res = (
            supabase.table("lc_problems")
            .select("id, title, slug, difficulty, topic_tags, internal_difficulty")
            .in_("id", problem_ids[:200])
            .execute()
        )
        prob_map = {p["id"]: p for p in (prob_res.data or [])}

        for cq in res.data:
            pid = cq.get("problem_id")
            if not pid or pid in existing_ids:
                continue
            prob = prob_map.get(pid)
            if not prob:
                continue
            # Check if problem is in required topics
            topic_tags = prob.get("topic_tags") or []
            problem_topics = {TAG_TO_TOPIC[t] for t in topic_tags if t in TAG_TO_TOPIC}
            if not problem_topics.intersection(required_topics):
                continue
            supplemental.append({
                "problem": prob,
                "frequency": float(cq.get("frequency") or 0.0) * 0.5,  # discount supplemental
                "windows": cq.get("windows") or [],
                "is_general_practice": True,
            })
            existing_ids.add(pid)
            if len(supplemental) >= target_size:
                break

        offset += limit
        if len(res.data) < limit:
            break

    logger.info(f"Loaded {len(supplemental)} supplemental general-practice problems")
    return supplemental


class PlanRecommender:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def build_plan(
        self,
        company: str,
        duration_days: int,
        mode: str,
        user: UserSkillModel,
        pool: list[dict[str, Any]],
        required_topics: set[str],
        profile: dict[str, Any],
    ) -> SelectedPlan:
        if duration_days not in DURATION_CONFIG:
            raise ValueError(f"Unsupported duration_days: {duration_days}")

        config = DURATION_CONFIG[duration_days]
        logger.info(
            f"Building plan: company={company}, duration={duration_days}d, "
            f"weeks={config['total_weeks']}, mode={mode}, pool_size={len(pool)}"
        )

        # ── Sparse company fallback ───────────────────────────────────────────
        effective_pool = pool
        is_sparse = len(pool) < SPARSE_COMPANY_THRESHOLD
        if is_sparse:
            logger.warning(
                f"Sparse company pool ({len(pool)} questions). "
                "Blending in general-practice problems."
            )
            supplemental = _load_general_fallback_pool(
                self.supabase, required_topics, pool
            )
            effective_pool = pool + supplemental

        weak_areas = profile.get("weak_areas") or []
        availability = get_topic_availability(effective_pool)
        if not availability:
            raise ValueError(f"No questions found for company '{company}'")

        week_topic_assignments = assign_topics_to_weeks_urgency(
            availability,
            config["total_weeks"],
            config["system_design_start_week"],
            config["behavioral_start_week"],
            effective_pool,
            user,
        )

        weeks: list[WeekSelection] = []
        all_questions: list[QuestionRef] = []
        selected_ids: set[int] = set()
        adjustments: list[str] = []

        # ── Adjustments summary (factual, not misleading) ─────────────────────
        if mode == "deep":
            if user.solved_problem_ids:
                adjustments.append(
                    f"Deprioritized {len(user.solved_problem_ids)} solved problems via "
                    f"score-based ranking (still eligible as refresh picks if rusty)."
                )
            if user.attempted_problem_ids:
                adjustments.append(
                    f"Prioritized {len(user.attempted_problem_ids)} ATTEMPTED problems in "
                    f"Week 1 slots for their respective topics."
                )
        else:
            adjustments.append(
                "Basic plan: difficulty progression adjusted from your public LeetCode profile."
            )

        blind_topics = [t for t in required_topics if user.topic_coverage(t) == 0]
        if blind_topics:
            adjustments.append(
                f"Flagged {len(blind_topics)} blind-spot topics (zero solves): "
                f"{', '.join(blind_topics[:5])}{'...' if len(blind_topics) > 5 else ''}."
            )

        if is_sparse:
            adjustments.append(
                f"Company pool was sparse ({len(pool)} questions). "
                "Supplemented with high-frequency general-practice problems for relevant topics."
            )

        # ── Week construction ─────────────────────────────────────────────────
        for week_num, assigned_topics in enumerate(week_topic_assignments, start=1):
            easy_pct, med_pct, hard_pct = config["difficulty_progression"][week_num - 1]
            target_q = QUESTIONS_PER_WEEK_TARGET[duration_days]
            week_avail = compute_week_availability(availability, assigned_topics)
            dsa_breakdown = compute_dsa_breakdown(week_avail, target_q, easy_pct, med_pct, hard_pct)

            sd_count = 2 if week_num >= config["system_design_start_week"] else 0
            behavioral_count = 2 if week_num >= config["behavioral_start_week"] else 0
            oops_count = 3 if week_num in [2, 3] else 0

            week_questions = select_questions_for_week(
                effective_pool,
                assigned_topics,
                dsa_breakdown,
                selected_ids,
                user,
                required_topics,
                weak_areas,
            )

            # Add OOPS questions (weeks 2-3)
            if oops_count > 0:
                oops_start = (week_num - 2) * oops_count
                for item in OOPS_POOL[oops_start: oops_start + oops_count]:
                    ref = synthetic_to_ref(item)
                    if ref.id not in selected_ids:
                        week_questions.append(ref)
                        selected_ids.add(ref.id)

            # Add System Design questions
            if sd_count > 0:
                sd_start = (week_num - config["system_design_start_week"]) * sd_count
                for item in SYSTEM_DESIGN_POOL[sd_start: sd_start + sd_count]:
                    ref = synthetic_to_ref(item)
                    if ref.id not in selected_ids:
                        week_questions.append(ref)
                        selected_ids.add(ref.id)

            # Add Behavioral questions
            if behavioral_count > 0:
                beh_start = (week_num - config["behavioral_start_week"]) * behavioral_count
                for item in BEHAVIORAL_POOL[beh_start: beh_start + behavioral_count]:
                    ref = synthetic_to_ref(item)
                    if ref.id not in selected_ids:
                        week_questions.append(ref)
                        selected_ids.add(ref.id)

            metrics = {
                "easy":   sum(1 for q in week_questions if (q.difficulty or "").lower() == "easy"),
                "medium": sum(1 for q in week_questions if (q.difficulty or "").lower() == "medium"),
                "hard":   sum(1 for q in week_questions if (q.difficulty or "").lower() == "hard"),
                "total":  len(week_questions),
                "estimated_hours": estimate_hours(
                    {
                        "easy":   sum(1 for q in week_questions if (q.difficulty or "").lower() == "easy"),
                        "medium": sum(1 for q in week_questions if (q.difficulty or "").lower() == "medium"),
                        "hard":   sum(1 for q in week_questions if (q.difficulty or "").lower() == "hard"),
                    },
                    sd_count, oops_count, behavioral_count,
                ),
            }

            weeks.append(
                WeekSelection(
                    week_number=week_num,
                    theme=generate_theme(assigned_topics),
                    focus_areas=assigned_topics,
                    question_ids=[q.id for q in week_questions],
                    questions=week_questions,
                    metrics=metrics,
                    estimated_hours=metrics["estimated_hours"],
                    notes=generate_notes(week_num),
                )
            )
            all_questions.extend(week_questions)
            logger.info(
                f"Week {week_num}: {len(week_questions)} questions, "
                f"topics={assigned_topics}, "
                f"E/M/H={metrics['easy']}/{metrics['medium']}/{metrics['hard']}"
            )

        return SelectedPlan(
            weeks=weeks,
            selected_questions=all_questions,
            adjustments_summary=adjustments,
            total_weeks=config["total_weeks"],
            total_questions=len(all_questions),
            company=company,
            duration_days=duration_days,
        )


def build_personalized_plan(
    supabase: Client,
    company: str,
    duration_days: int,
    mode: str,
    user: UserSkillModel,
    pool: list[dict[str, Any]],
    required_topics: set[str],
    profile: dict[str, Any],
) -> SelectedPlan:
    return PlanRecommender(supabase).build_plan(
        company, duration_days, mode, user, pool, required_topics, profile
    )
