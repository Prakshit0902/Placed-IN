from app.core.recommendation.constants import TAG_TO_TOPIC
from app.core.recommendation.user_model import UserSkillModel


def blind_spot_boost(topic: str, user: UserSkillModel, required_topics: set[str]) -> float:
    if topic not in required_topics:
        return 0.0
    coverage = user.topic_coverage(topic)
    if coverage == 0:
        return 2.0
    if coverage <= 2:
        return 1.0
    return 0.0


def score_candidate(
    cq: dict,
    user: UserSkillModel,
    required_topics: set[str],
    weak_areas: list[str],
) -> float:
    p = cq["problem"]
    freq = float(cq.get("frequency") or 0.0)
    score = freq

    tags = p.get("topic_tags") or []
    mapped = {TAG_TO_TOPIC[t] for t in tags if t in TAG_TO_TOPIC}
    for topic in mapped:
        score += blind_spot_boost(topic, user, required_topics)
        if any(w.lower() in topic.lower() or topic.lower() in w.lower() for w in weak_areas):
            score += 0.5

    if user.has_solved(p["id"]):
        score = -1.0

    return score


def sort_candidates(
    candidates: list[dict],
    user: UserSkillModel,
    required_topics: set[str],
    weak_areas: list[str],
) -> list[dict]:
    scored = [
        (score_candidate(c, user, required_topics, weak_areas), c)
        for c in candidates
    ]
    scored = [(s, c) for s, c in scored if s >= 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored]
