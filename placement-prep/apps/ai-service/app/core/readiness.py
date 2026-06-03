"""
readiness.py — Compute interview readiness score for a user against a company.

Formula (fixed from original):
    High-priority set H = top-40% of company pool by raw frequency (minimum 10 problems).
    Per-topic readiness = 100 × (Σ F_q for solved q in H_t) / (Σ F_q for all q in H_t)
    Overall readiness = Σ_t (W_t × Ready_t) / Σ_t W_t  where W_t = Σ F_q in H_t

Key fix: readiness is based on SOLVED problems' frequency coverage — not CGS-gap math.
This prevents ATTEMPTED problems from *reducing* readiness (they were getting S_q=1.40
which boosted their CGS gap, dragging down "gap coverage" for attempted users unfairly).

Additional improvements:
- pain_points: top-5 attempted problems in H not yet solved (highest freq first)
- preparation_tier: derived from overall readiness
- regeneration_recommended: if any topic readiness jumped ≥ 15 points since last snapshot
"""

from typing import Any
from app.core.recommendation.constants import TAG_TO_TOPIC
from app.core.recommendation.user_model import UserSkillModel
from app.core.logger import logger


def _topic_for_problem(problem: dict[str, Any]) -> str | None:
    for tag in problem.get("topic_tags") or []:
        if tag in TAG_TO_TOPIC:
            return TAG_TO_TOPIC[tag]
    return None


def _readiness_tier(overall: float) -> str:
    if overall >= 85:
        return "Interview-Ready"
    if overall >= 65:
        return "Advanced"
    if overall >= 35:
        return "Developing"
    return "Foundational"


def compute_readiness(
    company: str,
    user: UserSkillModel,
    pool: list[dict[str, Any]],
    previous_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Compute readiness score.

    Args:
        company:           company slug (for logging)
        user:              loaded UserSkillModel
        pool:              company question pool (enriched with 'problem' key)
        previous_snapshot: previously stored readiness_score JSON (for regen detection)

    Returns a dict with keys:
        overall, by_topic, estimated_weeks_to_target,
        preparation_tier, pain_points, regeneration_recommended
    """
    if not pool:
        return _empty_readiness()

    # ── Build high-priority set H: top-40% by raw frequency ──────────────────
    sorted_pool = sorted(pool, key=lambda x: float(x.get("frequency") or 0.0), reverse=True)
    top_n = max(10, int(len(sorted_pool) * 0.40))
    H = sorted_pool[:top_n]

    # ── Per-topic frequency sums ──────────────────────────────────────────────
    topic_total_freq: dict[str, float] = {}
    topic_solved_freq: dict[str, float] = {}

    pain_candidates: list[dict] = []  # problems in H that are ATTEMPTED but not SOLVED

    for cq in H:
        p = cq["problem"]
        freq = float(cq.get("frequency") or 0.0)
        pid = p["id"]
        topic = _topic_for_problem(p)
        if topic is None:
            continue

        topic_total_freq[topic] = topic_total_freq.get(topic, 0.0) + freq

        status = user.problem_status.get(pid)
        if status == "SOLVED":
            topic_solved_freq[topic] = topic_solved_freq.get(topic, 0.0) + freq
        elif status == "ATTEMPTED":
            # Track high-priority attempted problems for pain_points
            pain_candidates.append({
                "id": pid,
                "title": p.get("title", ""),
                "slug": p.get("slug", ""),
                "topic": topic,
                "frequency": freq,
                "difficulty": p.get("difficulty", "Medium"),
            })

    if not topic_total_freq:
        return _empty_readiness()

    # ── Per-topic readiness ───────────────────────────────────────────────────
    by_topic: dict[str, float] = {}
    for topic, total_f in topic_total_freq.items():
        solved_f = topic_solved_freq.get(topic, 0.0)
        by_topic[topic] = round(100.0 * solved_f / total_f, 1) if total_f > 0 else 0.0

    # ── Overall readiness (frequency-weighted across topics) ─────────────────
    overall_num = sum(
        topic_total_freq[t] * by_topic[t]
        for t in by_topic
    )
    overall_den = sum(topic_total_freq.values())
    overall = round(overall_num / overall_den, 1) if overall_den > 0 else 0.0

    # ── Estimated weeks to 85% target ────────────────────────────────────────
    gap = max(0.0, 85.0 - overall)
    # 8 points per week is the plan's estimate; realistic for a focused user
    estimated_weeks = max(1, round(gap / 8)) if gap > 0 else 0

    # ── Pain points: top-5 ATTEMPTED problems in H, sorted by frequency ──────
    pain_candidates.sort(key=lambda x: x["frequency"], reverse=True)
    pain_points = pain_candidates[:5]

    # ── Preparation tier ─────────────────────────────────────────────────────
    preparation_tier = _readiness_tier(overall)

    # ── Regeneration recommendation ──────────────────────────────────────────
    regeneration_recommended = False
    if previous_snapshot and previous_snapshot.get("by_topic"):
        prev_by_topic = previous_snapshot["by_topic"]
        for topic, new_score in by_topic.items():
            old_score = prev_by_topic.get(topic, 0.0)
            if new_score - old_score >= 15.0:
                regeneration_recommended = True
                logger.info(
                    f"Regen recommended: topic '{topic}' readiness jumped "
                    f"{old_score:.1f} → {new_score:.1f}"
                )
                break

    logger.info(
        f"Readiness for {company}: overall={overall}%, tier={preparation_tier}, "
        f"estimated_weeks={estimated_weeks}, pain_points={len(pain_points)}"
    )

    return {
        "overall": overall,
        "by_topic": by_topic,
        "estimated_weeks_to_target": estimated_weeks,
        "preparation_tier": preparation_tier,
        "pain_points": pain_points,
        "regeneration_recommended": regeneration_recommended,
    }


def _empty_readiness() -> dict[str, Any]:
    return {
        "overall": 0.0,
        "by_topic": {},
        "estimated_weeks_to_target": 12,
        "preparation_tier": "Foundational",
        "pain_points": [],
        "regeneration_recommended": False,
    }
