import json
import logging
from dataclasses import dataclass
from typing import Optional

from supabase import Client
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

# ----- Configuration -----

TOPIC_LEARNING_SEQUENCE = [
    "arrays", "strings", "math",
    "linked-list", "stack", "queue",
    "trees", "graphs", "heaps",
    "hash-table", "dynamic-programming",
    "bit-manipulation", "backtracking", "greedy",
    "design", "database", "system-design",
    "concurrency", "behavioral"
]

DURATION_CONFIG = {
    30: {
        "total_weeks": 5,
        "min_questions": 30,  # Lowered for Phase 1 MVP 
        "max_questions": 120,
        "system_design_start_week": 4,
        "behavioral_start_week": 5,
        "difficulty_progression": [
            (0.85, 0.15, 0.00),
            (0.70, 0.30, 0.00),
            (0.50, 0.45, 0.05),
            (0.30, 0.55, 0.15),
            (0.20, 0.55, 0.25),
        ]
    },
    60: {
        "total_weeks": 9,
        "min_questions": 50,  # Lowered for Phase 1 MVP
        "max_questions": 200,
        "system_design_start_week": 6,
        "behavioral_start_week": 7,
        "difficulty_progression": [
            (0.90, 0.10, 0.00),
            (0.75, 0.25, 0.00),
            (0.60, 0.35, 0.05),
            (0.50, 0.45, 0.05),
            (0.35, 0.55, 0.10),
            (0.25, 0.60, 0.15),
            (0.15, 0.60, 0.25),
            (0.10, 0.60, 0.30),
            (0.10, 0.55, 0.35),
        ]
    },
    90: {
        "total_weeks": 13,
        "min_questions": 80,  # Lowered for Phase 1 MVP
        "max_questions": 260,
        "system_design_start_week": 8,
        "behavioral_start_week": 10,
        "difficulty_progression": [
            (0.90, 0.10, 0.00),
            (0.85, 0.15, 0.00),
            (0.75, 0.25, 0.00),
            (0.65, 0.30, 0.05),
            (0.55, 0.40, 0.05),
            (0.45, 0.50, 0.05),
            (0.35, 0.55, 0.10),
            (0.25, 0.60, 0.15),
            (0.20, 0.60, 0.20),
            (0.15, 0.60, 0.25),
            (0.10, 0.60, 0.30),
            (0.10, 0.55, 0.35),
            (0.10, 0.50, 0.40),
        ]
    }
}

QUESTIONS_PER_WEEK_TARGET = {
    30: 22,
    60: 20,
    90: 19,
}

@dataclass
class TopicAvailability:
    topic: str
    total: int
    easy: int
    medium: int
    hard: int

class TemplateGenerator:
    def __init__(self, qdrant: QdrantClient, db_conn: Client, collection_name: str = "placement_questions"):
        self.qdrant = qdrant
        self.db = db_conn
        self.collection_name = collection_name
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """Supabase manages schemas via migrations or its dashboard.
        We skip raw SQL table creation here when using Supabase client."""
        pass

    def generate_all(self):
        """Generate templates for all company/role combos in Qdrant."""
        combos = self._get_all_company_role_combos()
        generated = 0

        for company, role in combos:
            for duration in [30, 60, 90]:
                try:
                    template = self.generate(company, role, duration)
                    if template:
                        self._upsert_template(template)
                        generated += 1
                        logger.info(f"Generated: {company}/{role}/{duration}d")
                except Exception as e:
                    logger.error(f"Failed {company}/{role}/{duration}d: {e}")

        logger.info(f"Total templates generated: {generated}")

    def generate(self, company: str, role: str, duration_days: int) -> Optional[dict]:
        """Generate one template for a company/role/duration combo."""
        config = DURATION_CONFIG[duration_days]

        # Step 1: Get topic availability from Qdrant
        availability = self._get_topic_availability(company, role)
        total_available = sum(t.total for t in availability.values())
        
        # We proceed even if we only have a few questions for MVP purposes
        if total_available < 10:  
            logger.warning(f"Extremely low questions for {company}/{role}: {total_available}. Generating fallback sheet anyway.")

        # Step 2: Assign topics to weeks (respecting sequence, even if availability is 0)
        week_topic_assignments = self._assign_topics_to_weeks(
            availability=availability,
            total_weeks=config["total_weeks"],
            system_design_start=config["system_design_start_week"],
            behavioral_start=config["behavioral_start_week"]
        )

        weeks = []
        total_questions = 0

        # Step 3: Build week structures
        for week_num, assigned_topics in enumerate(week_topic_assignments, start=1):
            easy_pct, med_pct, hard_pct = config["difficulty_progression"][week_num - 1]
            target_q = QUESTIONS_PER_WEEK_TARGET[duration_days]

            # Compute available questions for this week's topics
            week_availability = self._compute_week_availability(availability, assigned_topics)

            # Apply difficulty distribution
            dsa_breakdown = self._compute_dsa_breakdown(
                week_availability, target_q, easy_pct, med_pct, hard_pct, week_num, config
            )

            sd_count = 2 if week_num >= config["system_design_start_week"] else 0
            behavioral_count = 2 if week_num >= config["behavioral_start_week"] else 0
            oops_count = 3 if week_num in [2, 3] else 0

            week_total = sum(dsa_breakdown.values()) + sd_count + behavioral_count + oops_count
            total_questions += week_total

            # Important bottleneck 4 fix: Set "Content coming soon" warning if week_total == 0
            notes = self._generate_notes(assigned_topics, week_num)
            if week_total == 0:
                notes = "Content coming soon! We are actively adding more questions to this section."

            weeks.append({
                "week_number": week_num,
                "theme": self._generate_theme(assigned_topics, week_num),
                "focus_areas": assigned_topics,
                "breakdown": {
                    "dsa": dsa_breakdown,
                    "system_design": sd_count,
                    "oops": oops_count,
                    "behavioral": behavioral_count
                },
                "total_questions": week_total,
                "estimated_hours": self._estimate_hours(dsa_breakdown, sd_count, oops_count, behavioral_count),
                "notes": notes
            })

        template_id = (
            f"{company.lower().replace(' ', '_')}"
            f"_{role.lower().replace('-', '').replace(' ', '_')}"
            f"_{duration_days}day"
        )

        return {
            "template_id": template_id,
            "company": company,
            "role": role,
            "duration_days": duration_days,
            "total_weeks": config["total_weeks"],
            "total_questions": total_questions,
            "template_data": {"weeks": weeks},
            "generated_from_question_count": total_available
        }

    def _get_topic_availability(self, company: str, role: str) -> dict[str, TopicAvailability]:
        """Query Qdrant to find available questions per topic."""
        result = {}

        for topic in TOPIC_LEARNING_SEQUENCE:
            result[topic] = TopicAvailability(topic=topic, total=0, easy=0, medium=0, hard=0)
            
            for difficulty in ["easy", "medium", "hard"]:
                count = self.qdrant.count(
                    collection_name=self.collection_name,
                    count_filter=Filter(
                        must=[
                            FieldCondition(key="company", match=MatchValue(value=company)),
                            FieldCondition(key="role", match=MatchValue(value=role)),
                            FieldCondition(key="topics", match=MatchValue(value=topic)),
                            FieldCondition(key="difficulty", match=MatchValue(value=difficulty))
                        ]
                    )
                ).count
                
                setattr(result[topic], difficulty, count)
                result[topic].total += count

        return result

    def _assign_topics_to_weeks(
        self, availability: dict, total_weeks: int, system_design_start: int, behavioral_start: int
    ) -> list[list[str]]:
        """
        Assign topics to weeks following the learning sequence.
        Regardless of strict availability, we keep the sequence intact for the UI.
        """
        # We process all DSA topics in standard order so UI layout shows them
        dsa_topics = [t for t in TOPIC_LEARNING_SEQUENCE if t not in ["system-design", "database", "behavioral"]]
        topics_per_week = max(1, len(dsa_topics) // total_weeks)
        assignments = []

        topic_idx = 0
        for week in range(1, total_weeks + 1):
            week_topics = []
            for _ in range(topics_per_week):
                if topic_idx < len(dsa_topics):
                    week_topics.append(dsa_topics[topic_idx])
                    topic_idx += 1

            if week >= system_design_start:
                week_topics.append("system-design")

            assignments.append(week_topics)

        while topic_idx < len(dsa_topics):
            assignments[-1].append(dsa_topics[topic_idx])
            topic_idx += 1

        return assignments

    def _compute_dsa_breakdown(
        self, week_availability: dict, target_q: int, easy_pct: float, med_pct: float, hard_pct: float, week_num: int, config: dict
    ) -> dict:
        target_easy = int(target_q * easy_pct)
        target_med = int(target_q * med_pct)
        target_hard = int(target_q * hard_pct)

        avail_easy = week_availability.get("easy", 0)
        avail_med = week_availability.get("medium", 0)
        avail_hard = week_availability.get("hard", 0)

        actual_easy = min(target_easy, avail_easy)
        actual_med = min(target_med, avail_med)
        actual_hard = min(target_hard, avail_hard)

        # Attempt to fill gaps from other difficulties
        if actual_hard < target_hard:
            actual_med = min(avail_med, actual_med + (target_hard - actual_hard))
        if actual_med < target_med:
            actual_easy = min(avail_easy, actual_easy + (target_med - actual_med))

        return {"easy": actual_easy, "medium": actual_med, "hard": actual_hard}

    def _compute_week_availability(self, availability: dict, topics: list[str]) -> dict:
        easy = sum(availability[t].easy for t in topics if t in availability)
        medium = sum(availability[t].medium for t in topics if t in availability)
        hard = sum(availability[t].hard for t in topics if t in availability)
        return {"easy": easy, "medium": medium, "hard": hard}

    def _estimate_hours(self, dsa: dict, sd: int, oops: int, behavioral: int) -> float:
        return round(
            dsa.get("easy", 0) * (20/60) +
            dsa.get("medium", 0) * (45/60) +
            dsa.get("hard", 0) * (90/60) +
            sd * 1.0 + oops * 0.5 + behavioral * (20/60), 1
        )

    def _generate_theme(self, topics: list[str], week_num: int) -> str:
        if not topics:
            return f"Week {week_num} Focus"
        clean = [t.replace("-", " ").title() for t in topics[:2]]
        return " & ".join(clean)

    def _generate_notes(self, topics: list[str], week_num: int) -> str:
        notes = {
            1: "Focus on pattern recognition. Solve easy variants first.",
            2: "Start recognizing two-pointer and sliding window patterns.",
            3: "Recursion is the foundation for trees and graphs.",
        }
        return notes.get(week_num, "Focus on understanding patterns and applying previous learning.")

    def _get_all_company_role_combos(self) -> list[tuple[str, str]]:
        """Get unique company/role pairs from Qdrant."""
        combos = set()
        offset = None

        while True:
            # We do a scan/scroll over 1 point at a time with a dummy limit to discover unique values faster if need replace.
            # Due to lack of unique API in qdrant payload, we iterate payload manually.
            results, offset = self.qdrant.scroll(
                collection_name=self.collection_name,
                limit=1000,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )

            for point in results:
                company = point.payload.get("company")
                role = point.payload.get("role", "SDE") # fallback SDE if missing
                if company:
                    combos.add((company, role))

            if offset is None:
                break

        return list(combos)

    def _upsert_template(self, template: dict):
        try:
            data = {
                "id": template["template_id"],
                "company": template["company"],
                "role": template["role"],
                "duration_days": template["duration_days"],
                "total_weeks": template["total_weeks"],
                "total_questions": template["total_questions"],
                "template_data": template["template_data"],
                "generated_from_question_count": template["generated_from_question_count"]
            }
            # Using Supabase's upsert functionality
            response = self.db.table("prep_templates").upsert(data, on_conflict="id").execute()
            logger.debug(f"Upserted template {template['template_id']}")
        except Exception as e:
            logger.error(f"Failed to upsert template {template['template_id']}: {e}")
