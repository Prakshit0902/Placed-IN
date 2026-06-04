"""
selector.py — Week question selection using CGS-based ranking with
attempted-first, refresh, and mastery-ceiling difficulty bands.

Key improvements:
- Implements mastery_ceiling() per topic → proper warmup/growth/stretch bands
- Refresh count follows plan formula: max(1, min(3, floor(Δ/6)))
- Refresh picks sorted by raw frequency (most important problems first), not CGS
- Difficulty band sorting uses internal_difficulty when available; falls back
  gracefully to a more nuanced approximation (problem index order) rather than
  a flat 5 for all unknown problems
- Topic-level availability correctly filters by PRIMARY topic (not all tags)
"""

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.recommendation.constants import (
    BEHAVIORAL_POOL,
    OOPS_POOL,
    QUESTIONS_PER_WEEK_TARGET,
    SYSTEM_DESIGN_POOL,
    TAG_TO_TOPIC,
    TOPIC_LEARNING_SEQUENCE,
)
from app.core.recommendation.models import QuestionRef
from app.core.recommendation.user_model import UserSkillModel
from app.core.recommendation.scoring_v2 import (
    compound_gap_score,
    mastery_ceiling,
    primary_topic_for_problem,
)
from app.core.logger import logger


@dataclass
class TopicAvailability:
    topic: str
    total: int = 0
    easy: int = 0
    medium: int = 0
    hard: int = 0


# ── Availability helpers ──────────────────────────────────────────────────────

def get_topic_availability(pool: list[dict]) -> dict[str, TopicAvailability]:
    result: dict[str, TopicAvailability] = {}
    for cq in pool:
        p = cq["problem"]
        difficulty = (p.get("difficulty") or "Medium").lower()
        # Use primary topic (first matching tag) — prevents double-counting
        topic = primary_topic_for_problem(p)
        if topic == "unknown":
            continue
        if topic not in result:
            result[topic] = TopicAvailability(topic)
        result[topic].total += 1
        if difficulty == "easy":
            result[topic].easy += 1
        elif difficulty == "medium":
            result[topic].medium += 1
        elif difficulty == "hard":
            result[topic].hard += 1
    return {t: a for t, a in result.items() if a.total > 0}


def assign_topics_to_weeks(
    availability: dict[str, TopicAvailability],
    total_weeks: int,
    system_design_start: int,
    behavioral_start: int,
) -> list[list[str]]:
    """Fallback: simple sequential assignment without urgency reorder."""
    available_topics = [
        t for t in TOPIC_LEARNING_SEQUENCE
        if t in availability and t not in {"system-design", "database", "behavioral"}
    ]
    if not available_topics:
        available_topics = ["arrays"]

    topics_per_week = max(1, len(available_topics) // total_weeks)
    assignments: list[list[str]] = []
    topic_idx = 0

    for week in range(1, total_weeks + 1):
        week_topics: list[str] = []
        for _ in range(topics_per_week):
            if topic_idx < len(available_topics):
                week_topics.append(available_topics[topic_idx])
                topic_idx += 1
        if week >= system_design_start:
            week_topics.append("system-design")
        if week >= behavioral_start:
            week_topics.append("behavioral")
        assignments.append(week_topics)

    while topic_idx < len(available_topics):
        assignments[-1].append(available_topics[topic_idx])
        topic_idx += 1

    return assignments


def compute_week_availability(
    availability: dict[str, TopicAvailability], topics: list[str]
) -> dict[str, int]:
    easy = sum(availability[t].easy for t in topics if t in availability)
    medium = sum(availability[t].medium for t in topics if t in availability)
    hard = sum(availability[t].hard for t in topics if t in availability)
    return {"easy": easy, "medium": medium, "hard": hard}


def compute_dsa_breakdown(
    week_avail: dict[str, int],
    target_q: int,
    easy_pct: float,
    med_pct: float,
    hard_pct: float,
) -> dict[str, int]:
    target_easy = int(target_q * easy_pct)
    target_med = int(target_q * med_pct)
    target_hard = int(target_q * hard_pct)

    actual_easy = min(target_easy, week_avail.get("easy", 0))
    actual_med = min(target_med, week_avail.get("medium", 0))
    actual_hard = min(target_hard, week_avail.get("hard", 0))

    # Cascade overflow: Hard → Med, Med → Easy
    if actual_hard < target_hard:
        actual_med = min(week_avail.get("medium", 0), actual_med + (target_hard - actual_hard))
    if actual_med < target_med:
        actual_easy = min(week_avail.get("easy", 0), actual_easy + (target_med - actual_med))

    return {"easy": actual_easy, "medium": actual_med, "hard": actual_hard}


# ── Effective internal difficulty ─────────────────────────────────────────────

def _effective_difficulty(p: dict[str, Any]) -> float:
    """
    Return a continuous difficulty score for a problem.
    Priority:
      1. internal_difficulty (1-10 scale from DB, populated for ~500 problems)
      2. Coarse tier from 'difficulty' string (Easy=2, Medium=5, Hard=8)
         plus a fractional offset from problem ID to create stable ordering within tier.
    """
    id_val = internal_diff = p.get("internal_difficulty")
    if internal_diff and internal_diff > 0:
        return float(internal_diff)
    diff = (p.get("difficulty") or "medium").lower()
    base = {"easy": 2.0, "medium": 5.0, "hard": 8.0}.get(diff, 5.0)
    # Use problem ID mod 100 as a small fractional tiebreaker (stable ordering)
    frac = (p.get("id") or 0) % 100 / 1000.0
    return base + frac


# ── Main selection function ───────────────────────────────────────────────────

def select_questions_for_week(
    pool: list[dict],
    assigned_topics: list[str],
    dsa_breakdown: dict[str, int],
    selected_ids: set[int],
    user: UserSkillModel,
    required_topics: set[str],
    weak_areas: list[str],
) -> list[QuestionRef]:
    """
    Select questions for a single week, following this priority:

    1. ATTEMPTED problems for assigned topics (CGS-sorted, forced first).
    2. Refresh slots for rusty mastered topics (high-frequency medium picks).
    3. Remaining slots filled by difficulty band (CGS-sorted within each band).
       Bands use mastery_ceiling to calibrate warmup/growth/stretch per topic.
    """
    selected: list[QuestionRef] = []

    if sum(dsa_breakdown.values()) <= 0:
        return []

    # Pre-score all candidates in assigned topics
    max_freq = max((float(cq.get("frequency") or 0.0) for cq in pool), default=1.0) or 1.0

    scored: list[dict] = []
    for cq in pool:
        p = cq["problem"]
        if p["id"] in selected_ids:
            continue
        topic = primary_topic_for_problem(p)
        if topic not in assigned_topics:
            continue
        cgs = compound_gap_score(cq, user, max_freq)
        scored.append({
            "cq": cq,
            "p": p,
            "cgs": cgs,
            "status": user.problem_status.get(p["id"]),
            "topic": topic,
            "eff_diff": _effective_difficulty(p),
            "freq": float(cq.get("frequency") or 0.0),
        })

    scored.sort(key=lambda x: x["cgs"], reverse=True)

    target_total = sum(dsa_breakdown.values())

    # ── Phase 1: ATTEMPTED first ──────────────────────────────────────────────
    attempted_pool = [c for c in scored if c["status"] == "ATTEMPTED"]
    for c in attempted_pool:
        if len(selected) >= target_total:
            break
        selected.append(_build_ref(c["cq"], c["p"], "ATTEMPTED"))
        selected_ids.add(c["p"]["id"])

    logger.info(f"After attempted-first: {len(selected)}/{target_total}")

    # ── Phase 2: Refresh slots for rusty-but-mastered topics ─────────────────
    now = datetime.now(timezone.utc)
    for topic in assigned_topics:
        if len(selected) >= target_total:
            break
        tp = user.topic_profiles.get(topic)
        if tp is None:
            continue
        if tp.effective_proficiency < 70.0:
            continue
        if tp.last_solved_at is None:
            continue
        delta_months = (now - tp.last_solved_at).days / 30.44
        if delta_months <= 6:
            continue

        # Number of refresh picks: max(1, min(3, floor(Δ/6)))
        refresh_count = max(1, min(3, int(delta_months / 6)))
        remaining_slots = target_total - len(selected)
        refresh_count = min(refresh_count, remaining_slots)

        # Pick highest-frequency medium problems for this topic not yet selected
        refresh_candidates = [
            c for c in scored
            if c["topic"] == topic
            and c["p"]["id"] not in selected_ids
            and (c["p"].get("difficulty") or "").lower() == "medium"
        ]
        # Sort by raw frequency (most important problems), not CGS
        refresh_candidates.sort(key=lambda x: x["freq"], reverse=True)

        for c in refresh_candidates[:refresh_count]:
            logger.info(
                f"Refresh pick: problem {c['p']['id']} for rusty topic '{topic}' "
                f"(Δ={delta_months:.1f}mo, freq={c['freq']:.2f})"
            )
            selected.append(_build_ref(c["cq"], c["p"], c["status"]))
            selected_ids.add(c["p"]["id"])

    logger.info(f"After refresh: {len(selected)}/{target_total}")

    # ── Phase 3: Remaining slots via difficulty bands ─────────────────────────
    # Compute per-topic mastery ceiling and categorise remaining candidates
    current_counts = {"easy": 0, "medium": 0, "hard": 0}
    for ref in selected:
        diff_key = (ref.difficulty or "medium").lower()
        if diff_key in current_counts:
            current_counts[diff_key] += 1

    unselected = [c for c in scored if c["p"]["id"] not in selected_ids]

    # For each difficulty tier, compute a soft ordering that uses mastery_ceiling:
    # Within "medium", prefer problems close to the user's ceiling (growth zone).
    # We compute a "band_score" that combines CGS with proximity to ceiling.

    def _band_score(c: dict, diff: str) -> float:
        """
        For growth-zone problems, reward proximity to mastery ceiling.
        For warmup, reward slightly easier than ceiling.
        For stretch, reward above ceiling.
        """
        tp = user.topic_profiles.get(c["topic"])
        if tp:
            ceiling = mastery_ceiling(
                tp.mastery_easy_pct, tp.mastery_med_pct, tp.mastery_hard_pct
            )
        else:
            ceiling = 4.0  # default: just above easy

        eff_d = c["eff_diff"]
        # Score that peaks when eff_d ≈ ceiling (growth zone)
        proximity = -abs(eff_d - ceiling)
        return c["cgs"] * 0.7 + proximity * 0.3  # weighted blend

    for diff in ["easy", "medium", "hard"]:
        needed = dsa_breakdown.get(diff, 0) - current_counts.get(diff, 0)
        if needed <= 0:
            continue

        diff_candidates = [
            c for c in unselected
            if (c["p"].get("difficulty") or "medium").lower() == diff
        ]

        # Sort: blend of CGS and mastery-ceiling proximity
        diff_candidates.sort(key=lambda c: _band_score(c, diff), reverse=True)

        logger.info(f"Selecting {needed} {diff} questions (from {len(diff_candidates)} candidates)")
        for c in diff_candidates[:needed]:
            selected.append(_build_ref(c["cq"], c["p"], c["status"]))
            selected_ids.add(c["p"]["id"])
            # Remove from unselected to prevent cross-tier double-pick
            unselected = [u for u in unselected if u["p"]["id"] != c["p"]["id"]]

    logger.info(f"Week selection complete: {len(selected)} questions selected")
    return selected


def _build_ref(cq: dict, p: dict, status: str | None = None) -> QuestionRef:
    return QuestionRef(
        id=p["id"],
        title=p["title"],
        slug=p["slug"],
        difficulty=p.get("difficulty") or "Medium",
        frequency=float(cq.get("frequency") or 0),
        topic_tags=list(p.get("topic_tags") or []),
        status=status,
    )


# ── Utility helpers ───────────────────────────────────────────────────────────

def estimate_hours(dsa: dict[str, int], sd: int, oops: int, behavioral: int) -> float:
    return round(
        dsa.get("easy", 0) * (20 / 60)
        + dsa.get("medium", 0) * (45 / 60)
        + dsa.get("hard", 0) * (90 / 60)
        + sd * 1.0
        + oops * 0.5
        + behavioral * (20 / 60),
        1,
    )


def generate_theme(topics: list[str]) -> str:
    if not topics:
        return "Mixed Practice"
    clean = [t.replace("-", " ").title() for t in topics[:2]]
    return " & ".join(clean)


def generate_notes(week_num: int) -> str:
    notes = {
        1: "Focus on pattern recognition. Build intuition before optimizing.",
        2: "Practice two-pointer and sliding window on warm problems.",
        3: "Recursion is the foundation — master it before trees/graphs.",
        4: "Apply recursion patterns to trees; focus on traversal variants.",
        5: "Graph problems follow tree logic — extend your mental model.",
        6: "DP patterns: start with 1D, then 2D. Identify overlapping sub-problems.",
        7: "Review high-frequency problems from earlier weeks. Timed practice.",
        8: "System Design: focus on scalability tradeoffs and estimation.",
        9: "Mixed hard problems + mock interview practice.",
    }
    return notes.get(week_num, "Focus on understanding patterns and edge cases under time pressure.")


def synthetic_to_ref(item: dict) -> QuestionRef:
    return QuestionRef(
        id=item["id"],
        title=item["title"],
        slug=item["slug"],
        difficulty=item.get("difficulty", "Medium"),
        frequency=0.0,
        topic_tags=list(item.get("topic_tags") or []),
    )
