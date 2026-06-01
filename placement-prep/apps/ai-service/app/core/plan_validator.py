from typing import Any, Dict, List, Set


def deterministic_weeks_from_plan(weeks_skeleton: List[Dict[str, Any]], allowed_ids: Set[int]) -> List[Dict[str, Any]]:
    weeks_out = []
    for w in weeks_skeleton:
        questions = []
        for q in w.get("questions", []):
            if q["id"] in allowed_ids:
                questions.append({
                    "id": q["id"],
                    "title": q["title"],
                    "slug": q["slug"],
                    "difficulty": q["difficulty"],
                })
        weeks_out.append({
            "week": w["week_number"],
            "theme": w.get("theme", "Practice"),
            "questions": questions,
            "metrics": w.get("metrics", {"easy": 0, "medium": 0, "hard": 0, "total": len(questions), "estimated_hours": 0}),
        })
    return weeks_out


def validate_personalized_output(
    data: Dict[str, Any],
    allowed_ids: Set[int],
    expected_weeks: int,
) -> bool:
    seen: Set[int] = set()
    weeks = data.get("weeks") or []
    if len(weeks) != expected_weeks:
        return False
    for week in weeks:
        for q in week.get("questions") or []:
            qid = q.get("id")
            if qid not in allowed_ids or qid in seen:
                return False
            seen.add(qid)
    return True
