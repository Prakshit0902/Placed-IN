from dataclasses import dataclass, field
from typing import Any
@dataclass
class QuestionRef:
    id: int
    title: str
    slug: str
    difficulty: str
    frequency: float = 0.0
    topic_tags: list[str] = field(default_factory=list)
    status: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "difficulty": self.difficulty,
            "frequency": self.frequency,
            "topic_tags": self.topic_tags,
            "status": self.status,
        }


@dataclass
class WeekSelection:
    week_number: int
    theme: str
    focus_areas: list[str]
    question_ids: list[int]
    questions: list[QuestionRef]
    metrics: dict[str, Any]
    estimated_hours: float
    notes: str = ""

    def to_week_question_ids_entry(self) -> dict[str, Any]:
        return {
            "week": self.week_number,
            "week_number": self.week_number,
            "theme": self.theme,
            "question_ids": self.question_ids,
        }


@dataclass
class SelectedPlan:
    weeks: list[WeekSelection]
    selected_questions: list[QuestionRef]
    adjustments_summary: list[str]
    total_weeks: int
    total_questions: int
    company: str
    duration_days: int

    @property
    def all_question_ids(self) -> set[int]:
        return {q.id for q in self.selected_questions}
