import pytest

from app.core.recommendation.scoring import blind_spot_boost, score_candidate
from app.core.recommendation.selector import compute_dsa_breakdown
from app.core.recommendation.user_model import UserSkillModel
from app.core.plan_validator import validate_personalized_output, deterministic_weeks_from_plan
from app.core.readiness import compute_readiness


def test_blind_spot_boost_zero_coverage():
    user = UserSkillModel.from_profile_only({"by_topic": {}, "weak_areas": []})
    assert blind_spot_boost("graphs", user, {"graphs", "arrays"}) == 2.0


def test_blind_spot_boost_no_boost_when_solved():
    user = UserSkillModel(profile={}, solved_problem_ids=set(), topic_solve_counts={"graphs": 10})
    assert blind_spot_boost("graphs", user, {"graphs"}) == 0.0


def test_score_candidate_excludes_solved():
    user = UserSkillModel(profile={}, solved_problem_ids={42}, topic_solve_counts={})
    cq = {
        "frequency": 0.9,
        "problem": {"id": 42, "difficulty": "Medium", "topic_tags": ["graph"]},
    }
    assert score_candidate(cq, user, {"graphs"}, []) < 0


def test_compute_dsa_breakdown_caps_to_availability():
    breakdown = compute_dsa_breakdown({"easy": 2, "medium": 1, "hard": 0}, 10, 0.5, 0.5, 0.0)
    assert breakdown["easy"] <= 2
    assert breakdown["medium"] <= 1


def test_validate_personalized_output_rejects_extra_id():
    allowed = {1, 2}
    data = {
        "weeks": [
            {"week": 1, "questions": [{"id": 1}, {"id": 2}]},
        ],
    }
    assert validate_personalized_output(data, allowed, 1) is True
    data_bad = {
        "weeks": [
            {"week": 1, "questions": [{"id": 1}, {"id": 99}]},
        ],
    }
    assert validate_personalized_output(data_bad, allowed, 1) is False


def test_deterministic_weeks_filters_invalid():
    skeleton = [
        {
            "week_number": 1,
            "theme": "Arrays",
            "questions": [
                {"id": 1, "title": "A", "slug": "a", "difficulty": "Easy"},
                {"id": 2, "title": "B", "slug": "b", "difficulty": "Easy"},
            ],
            "metrics": {},
        }
    ]
    weeks = deterministic_weeks_from_plan(skeleton, {1})
    assert len(weeks[0]["questions"]) == 1


def test_readiness_formula_mock_supabase(monkeypatch):
    class FakeLoader:
        def load(self, company):
            pass

        def get_pool(self, company):
            return [
                {"problem": {"id": 1, "topic_tags": ["array"]}, "frequency": 1.0},
                {"problem": {"id": 2, "topic_tags": ["array"]}, "frequency": 1.0},
            ]

    import app.core.readiness as readiness_mod

    monkeypatch.setattr(readiness_mod, "CompanyPool", lambda supabase: FakeLoader())

    user = UserSkillModel(profile={}, solved_problem_ids={1}, topic_solve_counts={})
    result = compute_readiness(None, "amazon", user)
    assert result["overall"] == 50.0
