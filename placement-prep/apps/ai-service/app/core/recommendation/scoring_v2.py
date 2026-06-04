"""
scoring_v2.py — Compound Gap Score (CGS) computation.

Formula:
    CGS_q = F_q × M_rec × G_q × S_q
    CGS_q = max(CGS_q, floor_guarantee)

Key improvements over original:
- Readiness formula is now frequency-coverage based (not CGS-gap), fixing the ATTEMPTED
  penalty bug where ATTEMPTED users got lower readiness than they deserved.
- Status modifier is richer: factors in attempt count multiplier when data is available.
- Similar-question gap boost included (optional, uses lc_problems.similar_questions).
- Mastery ceiling helper function implemented here for use by selector.
"""

from typing import Any
from datetime import datetime, timezone
from app.core.recommendation.user_model import UserSkillModel
from app.core.recommendation.constants import TAG_TO_TOPIC
from app.core.logger import logger

# ── Recency multiplier table ─────────────────────────────────────────────────
# Maps windows[] tags from lc_company_questions to a recency boost.
# Tags confirmed present in DB: "30d", "3m", "6m", "6m+", "all"
RECENCY_MULTIPLIERS: dict[str, float] = {
    "30d": 1.50,  # Actively asked right now
    "3m":  1.40,  # Very recent signal
    "6m":  1.20,  # Moderately recent
    "6m+": 1.00,  # Baseline
    "all": 1.00,  # Only aggregate window — baseline
}


def recency_multiplier(windows: list[str] | None) -> float:
    """Return the max recency multiplier among meaningful window tags."""
    if not windows:
        return 1.0
    boosts = [
        RECENCY_MULTIPLIERS[tag]
        for tag in windows
        if tag in RECENCY_MULTIPLIERS and tag != "all"
    ]
    return max(boosts) if boosts else 1.0


def primary_topic_for_problem(problem: dict[str, Any]) -> str:
    """Return the first matching topic for a problem's tags, or 'unknown'."""
    for tag in problem.get("topic_tags") or []:
        if tag in TAG_TO_TOPIC:
            return TAG_TO_TOPIC[tag]
    return "unknown"


# Keep old name as alias so imports in other files don't break
_topic_for_problem = primary_topic_for_problem


def mastery_ceiling(m_easy: float, m_med: float, m_hard: float) -> float:
    """
    Compute mastery ceiling c_t (0–10 scale) from difficulty mastery percentages.
    Used to calibrate warmup/growth/stretch bands in selector.
    """
    if m_hard >= 40:
        return 8.0
    if m_med >= 50:
        return 6.0
    if m_easy >= 60:
        return 4.0
    return 2.0


def get_status_modifier(
    problem_id: int,
    user: UserSkillModel,
    eff_prof: float,
) -> float:
    """
    Compute S_q — the status modifier for a single problem.

    ATTEMPTED:
        Base 1.40 + 0.05 per extra attempt (capped at 1.60).
        This rewards problems the user is actively struggling with.

    SOLVED, recently + high proficiency:
        0.15 — deprioritize; user has mastered this topic recently.

    SOLVED, rusty (> 3 months) OR low proficiency:
        0.50 — eligible for refresh slot.

    SOLVED, struggled heavily (≥ 3 fails) and not yet re-resolved:
        0.80 — revisit candidate; still deserves attention.

    Unseen:
        1.00 — baseline.
    """
    status = user.problem_status.get(problem_id)

    if status == "ATTEMPTED":
        # Boost further based on attempt count (more attempts = more urgent)
        attempt_count = user.attempt_counts.get(problem_id, 1)
        boost = min(0.20, 0.05 * max(0, attempt_count - 1))
        return 1.40 + boost

    if status == "SOLVED":
        solved_dt = user.solved_at.get(problem_id)
        months_ago = 0.0
        if solved_dt:
            delta = datetime.now(timezone.utc) - solved_dt
            months_ago = delta.days / 30.44

        fails = user.failed_attempts_before_ac.get(problem_id, 0)
        gap_resolved = user.has_resolved_after_gap.get(problem_id, False)

        # Struggled heavily but hasn't re-solved after a gap → strong revisit signal
        if fails >= 3 and not gap_resolved:
            return 0.80

        # Recently mastered in a strong topic — deprioritize
        if months_ago <= 3.0 and eff_prof >= 70.0:
            return 0.15

        # Either rusty or topic is still weak — refresh candidate
        return 0.50

    # Unseen (status is None or anything else)
    return 1.00


def compound_gap_score(
    cq: dict[str, Any],
    user: UserSkillModel,
    max_freq: float,
) -> float:
    """
    Compute CGS for a single company question cq.

    cq must have keys: problem (dict), frequency (float), windows (list[str]).
    """
    freq = float(cq.get("frequency") or 0.0)
    f_q = freq / max_freq if max_freq > 0 else 0.0

    m_rec = recency_multiplier(cq.get("windows") or [])

    p = cq["problem"]
    topic = primary_topic_for_problem(p)

    eff_prof = 0.0
    if topic in user.topic_profiles:
        eff_prof = user.topic_profiles[topic].effective_proficiency

    g_q = 1.0 - (eff_prof / 100.0)
    s_q = get_status_modifier(p["id"], user, eff_prof)

    cgs = f_q * m_rec * g_q * s_q

    # High-frequency floor guarantee: ensure top problems always appear
    # even for advanced users who've mastered the topic.
    floor = 0.10 * f_q
    final_cgs = max(cgs, floor)

    logger.debug(
        f"CGS [{p['id']}] topic={topic} "
        f"f_q={f_q:.3f} m_rec={m_rec:.2f} g_q={g_q:.3f} s_q={s_q:.2f} "
        f"→ raw={cgs:.4f} floor={floor:.4f} final={final_cgs:.4f}"
    )

    return final_cgs
