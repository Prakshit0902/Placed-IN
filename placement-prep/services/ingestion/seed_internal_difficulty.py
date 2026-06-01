"""
Seed lc_problems.internal_difficulty for high-frequency company questions.
Run: python seed_internal_difficulty.py
"""
import os
import re
from collections import defaultdict

from dotenv import load_dotenv
from supabase import create_client

load_dotenv("../../apps/api/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE = {"easy": 2, "medium": 5, "hard": 8}


def parse_ac_rate(ac_rate: str | None) -> float | None:
    if not ac_rate:
        return None
    match = re.search(r"([\d.]+)\s*%", ac_rate)
    if match:
        return float(match.group(1))
    return None


def heuristic_difficulty(difficulty: str | None, ac_rate: str | None) -> int:
    d = (difficulty or "Medium").lower()
    score = BASE.get(d, 5)
    pct = parse_ac_rate(ac_rate)
    if pct is not None:
        if pct < 35:
            score = min(10, score + 2)
        elif pct < 45:
            score = min(10, score + 1)
        elif pct > 60:
            score = max(1, score - 1)
    return max(1, min(10, score))


def main():
    freq_by_problem: dict[int, float] = defaultdict(float)
    offset = 0
    limit = 1000

    while True:
        res = (
            supabase.table("lc_company_questions")
            .select("problem_id, frequency")
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break
        for row in res.data:
            pid = row["problem_id"]
            if pid:
                freq_by_problem[pid] += float(row.get("frequency") or 0)
        offset += limit
        if len(res.data) < limit:
            break

    top_ids = [
        pid
        for pid, _ in sorted(freq_by_problem.items(), key=lambda x: x[1], reverse=True)[:500]
    ]

    print(f"Seeding internal_difficulty for {len(top_ids)} problems...")

    for i in range(0, len(top_ids), 100):
        chunk = top_ids[i : i + 100]
        prob_res = (
            supabase.table("lc_problems")
            .select("id, difficulty, ac_rate")
            .in_("id", chunk)
            .execute()
        )
        updates = []
        for p in prob_res.data or []:
            updates.append(
                {
                    "id": p["id"],
                    "internal_difficulty": heuristic_difficulty(p.get("difficulty"), p.get("ac_rate")),
                }
            )
        if updates:
            supabase.table("lc_problems").upsert(updates).execute()
        print(f"  Updated batch {i // 100 + 1}")

    print("Done.")


if __name__ == "__main__":
    main()
