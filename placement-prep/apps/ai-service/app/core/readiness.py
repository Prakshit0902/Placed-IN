from typing import Any

from app.core.recommendation.constants import TAG_TO_TOPIC
from app.core.recommendation.pool import CompanyPool
from app.core.recommendation.user_model import UserSkillModel
from app.core.recommendation.scoring_v2 import compound_gap_score, _topic_for_problem
from supabase import Client


def _topic_for_problem(problem: dict[str, Any]) -> str | None:
    for tag in problem.get("topic_tags") or []:
        if tag in TAG_TO_TOPIC:
            return TAG_TO_TOPIC[tag]
    return None


def compute_readiness(
    company: str,
    user: UserSkillModel,
    pool: list[dict[str, Any]],
) -> dict[str, Any]:

    if not pool:
        return {
            "overall": 0.0,
            "estimated_weeks_to_target": 12,
            "by_topic": {},
        }
        
    # Sort pool by frequency descending
    sorted_pool = sorted(pool, key=lambda x: float(x.get("frequency") or 0.0), reverse=True)
    top_40_count = max(10, int(len(sorted_pool) * 0.4))
    top_40 = sorted_pool[:top_40_count]
    
    max_freq = float(top_40[0].get("frequency") or 1.0) if top_40 else 1.0
    if max_freq == 0.0: max_freq = 1.0
    
    empty_user = UserSkillModel(profile={}) # empty user for max_gap
    
    total_gap = 0.0
    max_gap = 0.0
    
    topic_gaps: dict[str, float] = {}
    topic_maxes: dict[str, float] = {}

    for cq in top_40:
        actual_cgs = compound_gap_score(cq, user, max_freq)
        max_cgs = compound_gap_score(cq, empty_user, max_freq)
        
        total_gap += actual_cgs
        max_gap += max_cgs
        
        topic = _topic_for_problem(cq["problem"])
        if topic:
            topic_gaps[topic] = topic_gaps.get(topic, 0.0) + actual_cgs
            topic_maxes[topic] = topic_maxes.get(topic, 0.0) + max_cgs

    overall = max(0.0, 100.0 * (1.0 - total_gap / max_gap)) if max_gap > 0 else 0.0
    overall = round(overall, 1)

    by_topic: dict[str, float] = {}
    for topic, d_max in topic_maxes.items():
        n_gap = topic_gaps.get(topic, 0.0)
        t_readiness = max(0.0, 100.0 * (1.0 - n_gap / d_max)) if d_max > 0 else 0.0
        by_topic[topic] = round(t_readiness, 1)

    target = 85.0
    gap = max(0.0, target - overall)
    estimated_weeks = max(1, int(round(gap / 8))) if gap > 0 else 0

    return {
        "overall": overall,
        "estimated_weeks_to_target": estimated_weeks,
        "by_topic": by_topic,
    }
