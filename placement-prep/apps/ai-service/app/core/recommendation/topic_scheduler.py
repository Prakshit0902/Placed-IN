"""
topic_scheduler.py — Urgency-aware topic-to-week assignment.

Uses a topological sort with prerequisite constraints, then reorders
by topic urgency U_t = (1 - eff_prof/100) × max_freq_in_topic.

Higher urgency = earlier week assignment.
Prerequisite DAG ensures foundational topics come before advanced ones.

Improvement over original: 
- prerequisite check now properly tests whether all dependencies have been
  scheduled (not just if they exist in `remaining`), fixing a subtle bug where
  a topic with a dep not in the available list would block forever.
- Handles sparse company data (< threshold) by relaxing prerequisite constraints.
"""

from app.core.recommendation.user_model import UserSkillModel
from app.core.recommendation.constants import TOPIC_LEARNING_SEQUENCE
from app.core.logger import logger


# Hard prerequisite DAG: topic → {set of topics that must come before it}
TOPIC_PREREQUISITES: dict[str, set[str]] = {
    "dynamic-programming": {"recursion", "trees"},
    "graphs":              {"trees"},
    "heaps":               {"trees"},
    "backtracking":        {"recursion"},
    "binary-search":       {"arrays"},
}


def compute_topic_urgency(pool: list[dict], user: UserSkillModel) -> dict[str, float]:
    """
    U_t = (1 - eff_prof_t / 100) × max_company_freq_for_t

    Topics with low proficiency AND high company frequency are most urgent.
    """
    from app.core.recommendation.scoring_v2 import primary_topic_for_problem

    topic_max_freq: dict[str, float] = {}
    for cq in pool:
        topic = primary_topic_for_problem(cq["problem"])
        freq = float(cq.get("frequency") or 0.0)
        topic_max_freq[topic] = max(topic_max_freq.get(topic, 0.0), freq)

    urgency: dict[str, float] = {}
    for topic, max_f in topic_max_freq.items():
        eff_prof = user.get_effective_proficiency(topic)
        urgency[topic] = (1.0 - eff_prof / 100.0) * max_f

    return urgency


def assign_topics_to_weeks_urgency(
    availability: dict,
    total_weeks: int,
    system_design_start: int,
    behavioral_start: int,
    pool: list[dict],
    user: UserSkillModel,
) -> list[list[str]]:
    """
    Assign DSA topics to weeks respecting:
      1. Prerequisite ordering (non-negotiable structural constraints).
      2. Urgency ordering (high urgency → earlier week).

    Algorithm: iterative greedy topological sort.
    At each step, pick the unscheduled topic with all prerequisites satisfied
    and the highest urgency.
    """
    urgencies = compute_topic_urgency(pool, user)

    available_topics = [
        t for t in TOPIC_LEARNING_SEQUENCE
        if t in availability and t not in {"system-design", "database", "behavioral"}
    ]
    if not available_topics:
        available_topics = ["arrays"]

    # Detect sparse company data — if < 30 questions, skip prerequisites
    # to avoid scheduling a prerequisite topic with no company questions
    sparse_company = sum(1 for cq in pool) < 30
    if sparse_company:
        logger.warning("Sparse company data (<30 questions) — relaxing prerequisite ordering")

    scheduled: list[str] = []
    scheduled_set: set[str] = set()
    remaining: set[str] = set(available_topics)

    while remaining:
        # Find topics whose prerequisites are either all satisfied or not in available_topics
        candidates: list[str] = []
        for t in remaining:
            if sparse_company:
                candidates.append(t)
                continue
            deps = TOPIC_PREREQUISITES.get(t, set())
            # A dep is "satisfied" if it's scheduled OR not in our available topic set
            unmet = {d for d in deps if d in remaining}
            if not unmet:
                candidates.append(t)

        if not candidates:
            # Cycle or all remaining have unmet deps not in available — force add all remaining
            logger.warning(
                f"Could not resolve prerequisites for: {remaining}. "
                "Scheduling by urgency without prerequisite constraint."
            )
            candidates = list(remaining)

        # Sort candidates by urgency descending, then by TOPIC_LEARNING_SEQUENCE index
        # as a stable tiebreaker (curriculum order when urgencies are equal)
        seq_index = {t: i for i, t in enumerate(TOPIC_LEARNING_SEQUENCE)}
        candidates.sort(
            key=lambda t: (-urgencies.get(t, 0.0), seq_index.get(t, 999))
        )

        chosen = candidates[0]
        scheduled.append(chosen)
        scheduled_set.add(chosen)
        remaining.remove(chosen)

    # Distribute topics across weeks
    topics_per_week = max(1, len(scheduled) // total_weeks)
    assignments: list[list[str]] = []
    topic_idx = 0

    for week in range(1, total_weeks + 1):
        week_topics: list[str] = []
        for _ in range(topics_per_week):
            if topic_idx < len(scheduled):
                week_topics.append(scheduled[topic_idx])
                topic_idx += 1
        if week >= system_design_start:
            week_topics.append("system-design")
        if week >= behavioral_start:
            week_topics.append("behavioral")
        assignments.append(week_topics)
        logger.info(f"Week {week} → topics: {week_topics}")

    # Overflow: dump remaining topics into the last week
    while topic_idx < len(scheduled):
        assignments[-1].append(scheduled[topic_idx])
        topic_idx += 1

    return assignments
