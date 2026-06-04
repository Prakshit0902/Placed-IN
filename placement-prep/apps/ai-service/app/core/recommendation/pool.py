from collections import defaultdict
from typing import Any

from supabase import Client

from app.core.recommendation.constants import TAG_TO_TOPIC


class CompanyPool:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.all_problems: dict[int, dict[str, Any]] = {}
        self.company_questions: dict[str, list[dict[str, Any]]] = defaultdict(list)

    def load(self, company: str) -> None:
        company_key = company.lower().strip()
        self.all_problems.clear()
        self.company_questions.clear()

        limit = 1000
        offset = 0
        raw_company_questions = []

        # Step 1: Fetch company questions (and include 'windows')
        while True:
            res = (
                self.supabase.table("lc_company_questions")
                .select("problem_id, company, frequency, windows")
                .ilike("company", company_key)
                .range(offset, offset + limit - 1)
                .execute()
            )
            if not res.data:
                break
            raw_company_questions.extend(res.data)
            offset += limit
            if len(res.data) < limit:
                break

        # Fallback if no exact ilike match
        if not raw_company_questions:
            offset = 0
            while True:
                res = (
                    self.supabase.table("lc_company_questions")
                    .select("problem_id, company, frequency, windows")
                    .range(offset, offset + limit - 1)
                    .execute()
                )
                if not res.data:
                    break
                for cq in res.data:
                    if cq["company"].lower().strip() == company_key:
                        raw_company_questions.append(cq)
                offset += limit
                if len(res.data) < limit:
                    break

        problem_ids = list(set(cq["problem_id"] for cq in raw_company_questions))
        if not problem_ids:
            return

        # Step 2: Fetch lc_problems by ID in chunks
        chunk_size = 200
        for i in range(0, len(problem_ids), chunk_size):
            chunk = problem_ids[i:i + chunk_size]
            res = (
                self.supabase.table("lc_problems")
                .select("id, title, slug, difficulty, topic_tags, internal_difficulty")
                .in_("id", chunk)
                .execute()
            )
            for p in (res.data or []):
                self.all_problems[p["id"]] = p

        # Step 3: Populate company_questions mapping
        for cq in raw_company_questions:
            pid = cq["problem_id"]
            if pid in self.all_problems:
                self.company_questions[company_key].append(
                    {
                        "problem": self.all_problems[pid],
                        "frequency": cq.get("frequency") or 0.0,
                        "windows": cq.get("windows") or [],
                    }
                )

    def get_pool(self, company: str) -> list[dict[str, Any]]:
        return self.company_questions.get(company.lower().strip(), [])

    def required_topics(self, company: str) -> set[str]:
        topics: set[str] = set()
        for cq in self.get_pool(company):
            for tag in cq["problem"].get("topic_tags") or []:
                if tag in TAG_TO_TOPIC:
                    topics.add(TAG_TO_TOPIC[tag])
        return topics
