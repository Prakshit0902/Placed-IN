"""
Tests for the adaptive personalization engine.

Run with: pytest apps/ai-service/tests/test_engine.py -v
"""

from app.core.recommendation.scoring_v2 import (
    recency_multiplier,
    get_status_modifier,
    compound_gap_score,
    mastery_ceiling,
    primary_topic_for_problem,
)
from app.core.recommendation.user_model import UserSkillModel, TopicProfile
from app.core.recommendation.selector import select_questions_for_week
from app.core.readiness import compute_readiness
from datetime import datetime, timezone, timedelta


# ── recency_multiplier ────────────────────────────────────────────────────────

def test_recency_multiplier_30d():
    assert recency_multiplier(["30d", "6m"]) == 1.5

def test_recency_multiplier_baseline():
    assert recency_multiplier(["6m+", "all"]) == 1.0

def test_recency_multiplier_empty():
    assert recency_multiplier([]) == 1.0

def test_recency_multiplier_all_only():
    assert recency_multiplier(["all"]) == 1.0

def test_recency_multiplier_3m():
    assert recency_multiplier(["3m"]) == 1.4


# ── mastery_ceiling ───────────────────────────────────────────────────────────

def test_mastery_ceiling_hard():
    assert mastery_ceiling(100.0, 100.0, 50.0) == 8.0

def test_mastery_ceiling_medium():
    assert mastery_ceiling(100.0, 60.0, 10.0) == 6.0

def test_mastery_ceiling_easy():
    assert mastery_ceiling(70.0, 30.0, 0.0) == 4.0

def test_mastery_ceiling_beginner():
    assert mastery_ceiling(10.0, 0.0, 0.0) == 2.0


# ── get_status_modifier ───────────────────────────────────────────────────────

def test_status_modifier_attempted_base():
    user = UserSkillModel(profile={}, problem_status={1: "ATTEMPTED"})
    # attempt_count defaults to 1 → boost = 0
    assert get_status_modifier(1, user, 0.0) == 1.40

def test_status_modifier_attempted_with_extra_attempts():
    user = UserSkillModel(
        profile={}, problem_status={1: "ATTEMPTED"}, attempt_counts={1: 3}
    )
    # boost = min(0.20, 0.05 * (3-1)) = 0.10
    assert get_status_modifier(1, user, 0.0) == 1.50

def test_status_modifier_attempted_max_boost():
    import math
    user = UserSkillModel(
        profile={}, problem_status={1: "ATTEMPTED"}, attempt_counts={1: 20}
    )
    # capped at 0.20
    assert math.isclose(get_status_modifier(1, user, 0.0), 1.60, rel_tol=1e-9)

def test_status_modifier_solved_recent_mastered():
    now = datetime.now(timezone.utc)
    user = UserSkillModel(
        profile={}, problem_status={2: "SOLVED"}, solved_at={2: now - timedelta(days=10)}
    )
    # recent (10 days), eff_prof 80 >= 70 → deprioritize
    assert get_status_modifier(2, user, 80.0) == 0.15

def test_status_modifier_solved_recent_low_proficiency():
    now = datetime.now(timezone.utc)
    user = UserSkillModel(
        profile={}, problem_status={2: "SOLVED"}, solved_at={2: now - timedelta(days=10)}
    )
    # eff_prof < 70 → refresh candidate
    assert get_status_modifier(2, user, 50.0) == 0.50

def test_status_modifier_solved_rusty():
    now = datetime.now(timezone.utc)
    user = UserSkillModel(
        profile={}, problem_status={3: "SOLVED"}, solved_at={3: now - timedelta(days=200)}
    )
    # 200 days ≈ 6.5 months > 3 months → refresh candidate
    assert get_status_modifier(3, user, 80.0) == 0.50

def test_status_modifier_struggled():
    now = datetime.now(timezone.utc)
    user = UserSkillModel(
        profile={},
        problem_status={4: "SOLVED"},
        solved_at={4: now - timedelta(days=10)},
        failed_attempts_before_ac={4: 5},  # >= 3 fails
        has_resolved_after_gap={4: False},
    )
    # struggled + not re-resolved → revisit candidate
    assert get_status_modifier(4, user, 80.0) == 0.80

def test_status_modifier_unseen():
    user = UserSkillModel(profile={}, problem_status={})
    assert get_status_modifier(99, user, 50.0) == 1.00


# ── proficiency decay ─────────────────────────────────────────────────────────

def test_proficiency_decay_14_months():
    """Topic idle for 14 months should have significant decay."""
    from app.core.recommendation.profile_builder import _recency_decay
    decay = _recency_decay(14.0)
    # 14 months: max(0.40, 1.0 - 0.09*(14-6)) = max(0.40, 0.28) = 0.40
    assert decay == 0.40

def test_proficiency_decay_fresh():
    from app.core.recommendation.profile_builder import _recency_decay
    assert _recency_decay(2.0) == 1.0
    assert _recency_decay(6.0) == 1.0


# ── attempted-first selection ─────────────────────────────────────────────────

def test_attempted_first():
    """ATTEMPTED problem should appear before higher-frequency unseen problem."""
    user = UserSkillModel(profile={}, problem_status={1: "ATTEMPTED", 2: None})
    pool = [
        {
            "problem": {"id": 1, "title": "P1", "slug": "p1", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": 1.0, "windows": [],
        },
        {
            "problem": {"id": 2, "title": "P2", "slug": "p2", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": 2.0, "windows": [],
        },
    ]
    # Only 1 medium slot — should pick the ATTEMPTED problem (P1) not the higher-freq P2
    res = select_questions_for_week(pool, ["arrays"], {"medium": 1}, set(), user, set(), [])
    assert len(res) == 1
    assert res[0].id == 1


def test_attempted_all_fit():
    """When enough slots exist, both problems should be selected."""
    user = UserSkillModel(profile={}, problem_status={1: "ATTEMPTED", 2: None})
    pool = [
        {
            "problem": {"id": 1, "title": "P1", "slug": "p1", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": 1.0, "windows": [],
        },
        {
            "problem": {"id": 2, "title": "P2", "slug": "p2", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": 2.0, "windows": [],
        },
    ]
    res = select_questions_for_week(pool, ["arrays"], {"medium": 2}, set(), user, set(), [])
    assert len(res) == 2
    assert res[0].id == 1  # ATTEMPTED first


# ── solved deprioritization (not hard exclusion) ──────────────────────────────

def test_no_hard_skip_recent_mastered():
    """Solved + recent + high prof → deprioritized but NOT excluded when only option."""
    now = datetime.now(timezone.utc)
    user = UserSkillModel(
        profile={},
        problem_status={1: "SOLVED"},
        solved_at={1: now - timedelta(days=10)},
        topic_profiles={"arrays": TopicProfile("arrays", 80.0, 80.0, 100.0, 100.0, 0.0)},
    )
    pool = [
        {
            "problem": {"id": 1, "title": "P1", "slug": "p1", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": 1.0, "windows": [],
        },
    ]
    # Only one option; CGS floor guarantees it still appears
    res = select_questions_for_week(pool, ["arrays"], {"medium": 1}, set(), user, set(), [])
    assert len(res) == 1
    assert res[0].id == 1


# ── refresh rusty topic ───────────────────────────────────────────────────────

def test_refresh_rusty_topic():
    """Topic with prof >= 70 and Δ > 6 months should add refresh picks."""
    now = datetime.now(timezone.utc)
    rusty_dt = now - timedelta(days=210)  # ~7 months
    user = UserSkillModel(
        profile={},
        topic_profiles={
            "arrays": TopicProfile(
                "arrays", 80.0, 80.0, 100.0, 100.0, 30.0,
                last_solved_at=rusty_dt
            )
        },
    )
    pool = [
        {
            "problem": {"id": i, "title": f"P{i}", "slug": f"p{i}", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": float(i), "windows": [],
        }
        for i in range(1, 5)
    ]
    res = select_questions_for_week(pool, ["arrays"], {"medium": 3}, set(), user, set(), [])
    # Should have at least 1 refresh pick + fill remaining from CGS
    assert len(res) == 3
    # Refresh picks are sorted by frequency — highest freq medium problem should be a refresh pick
    frequencies = [cq["frequency"] for cq in pool if cq["problem"]["id"] in {r.id for r in res}]
    assert max(frequencies) == 4.0  # highest-freq problem included


# ── readiness formula ─────────────────────────────────────────────────────────

def test_readiness_empty_pool():
    user = UserSkillModel(profile={})
    res = compute_readiness("test", user, [])
    assert res["overall"] == 0.0
    assert res["estimated_weeks_to_target"] == 12


def test_readiness_all_solved():
    """User who solved all top-40% questions should have 100% readiness."""
    pool = [
        {
            "problem": {"id": i, "title": f"P{i}", "slug": f"p{i}", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": float(i),
        }
        for i in range(1, 21)
    ]
    # User solved all 20 problems
    user = UserSkillModel(
        profile={},
        problem_status={i: "SOLVED" for i in range(1, 21)},
    )
    res = compute_readiness("test", user, pool)
    assert res["overall"] == 100.0


def test_readiness_attempted_not_penalized():
    """ATTEMPTED problems should NOT reduce readiness (old bug fix)."""
    pool = [
        {
            "problem": {"id": i, "title": f"P{i}", "slug": f"p{i}", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": float(i),
        }
        for i in range(1, 21)
    ]
    # User has solved first 8, attempted problems 9-12 (no solve)
    problem_status = {i: "SOLVED" for i in range(1, 9)}
    problem_status.update({i: "ATTEMPTED" for i in range(9, 13)})
    user_with_attempted = UserSkillModel(profile={}, problem_status=problem_status)

    # User with only the 8 solves (no ATTEMPTED)
    user_no_attempted = UserSkillModel(
        profile={}, problem_status={i: "SOLVED" for i in range(1, 9)}
    )

    res_attempted = compute_readiness("test", user_with_attempted, pool)
    res_no_attempted = compute_readiness("test", user_no_attempted, pool)

    # ATTEMPTED should not make readiness worse than just having the solves
    assert res_attempted["overall"] == res_no_attempted["overall"]


def test_readiness_pain_points():
    """Pain points should list attempted-but-not-solved high-priority problems."""
    pool = [
        {
            "problem": {"id": i, "title": f"P{i}", "slug": f"p{i}", "topic_tags": ["array"], "difficulty": "Medium"},
            "frequency": float(i),
        }
        for i in range(1, 21)
    ]
    user = UserSkillModel(profile={}, problem_status={20: "ATTEMPTED", 19: "ATTEMPTED"})
    res = compute_readiness("test", user, pool)
    assert len(res["pain_points"]) == 2
    # Highest frequency attempted should be first
    assert res["pain_points"][0]["id"] == 20


def test_readiness_regeneration_flag():
    """regeneration_recommended should be True when a topic jumps >= 15 points."""
    pool = [
        {
            "problem": {
                "id": i,
                "title": f"P{i}",
                "slug": f"p{i}",
                "topic_tags": ["array"],
                "difficulty": "Medium",
            },
            "frequency": float(i),
        }
        for i in range(1, 21)
    ]
    # Top-40% = top 8 problems (ids 13-20, highest freq).
    # User has solved problems 15, 16, 17, 18, 19, 20 → big coverage jump.
    user = UserSkillModel(
        profile={},
        problem_status={i: "SOLVED" for i in range(15, 21)},
    )
    # Previous snapshot said arrays was 0%.
    prev_snapshot = {"by_topic": {"arrays": 0.0}}
    res = compute_readiness("test", user, pool, previous_snapshot=prev_snapshot)
    # 6 of the top 8 solved → arrays readiness ≥ 60%, jump from 0 is ≥ 15 → regen
    assert res["regeneration_recommended"] is True
