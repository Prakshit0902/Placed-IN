#!/usr/bin/env python3
"""
ingest_cf_problems.py
--------------------
Fetches all Codeforces problems from the public API and upserts into `cf_problems`.
Also populates `cf_topic_corpus_stats`.

Run from project root:
    python services/ingestion/ingest_cf_problems.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in services/ingestion/.env
"""

import os
import requests
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Config ─────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
assert SUPABASE_URL and SUPABASE_KEY, "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env"

BATCH_SIZE = 500

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_cf_problems() -> list[dict]:
    """Fetches problems from Codeforces API."""
    url = "https://codeforces.com/api/problemset.problems"
    print(f"Fetching problems from {url}...")
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    
    if data.get("status") != "OK":
        print("Failed to fetch problems from CF API")
        sys.exit(1)
        
    problems_data = data["result"]["problems"]
    statistics_data = {stat["contestId"]: stat for stat in data["result"]["problemStatistics"]}
    # problemStatistics is a list, actually it matches problems list 1-to-1 or we can index by (contestId, index)
    stats_map = {(stat["contestId"], stat["index"]): stat["solvedCount"] for stat in data["result"]["problemStatistics"]}
    
    records = []
    for p in problems_data:
        contest_id = p.get("contestId")
        index = p.get("index")
        if not contest_id or not index:
            continue
            
        prob_id = f"{contest_id}{index}"
        cf_url = f"https://codeforces.com/problemset/problem/{contest_id}/{index}"
        solved_count = stats_map.get((contest_id, index), 0)
        
        records.append({
            "id": prob_id,
            "contest_id": contest_id,
            "problem_index": index,
            "name": p.get("name", ""),
            "rating": p.get("rating"), # can be None
            "tags": p.get("tags", []),
            "solved_count": solved_count,
            "cf_url": cf_url,
            "editorial_url": None, # Future enhancement
        })
        
    print(f"  -> Found {len(records)} problems")
    return records


def upsert_batch(records: list[dict]) -> int:
    """Upserts a batch of problem records."""
    res = supabase.table("cf_problems").upsert(records, on_conflict="id").execute()
    return len(res.data) if res.data else 0


def populate_corpus_stats():
    """Populate the cf_topic_corpus_stats using the SQL query from the plan."""
    print("Populating cf_topic_corpus_stats...")
    query = """
    INSERT INTO public.cf_topic_corpus_stats (tag, rating_band, problem_count)
    SELECT
      unnest(tags) AS tag,
      CASE
        WHEN rating < 1000 THEN '800-1000'
        WHEN rating < 1200 THEN '1000-1200'
        WHEN rating < 1400 THEN '1200-1400'
        WHEN rating < 1600 THEN '1400-1600'
        WHEN rating < 1800 THEN '1600-1800'
        WHEN rating < 2000 THEN '1800-2000'
        WHEN rating < 2200 THEN '2000-2200'
        WHEN rating < 2400 THEN '2200-2400'
        ELSE '2400+'
      END AS rating_band,
      COUNT(*) AS problem_count
    FROM public.cf_problems
    WHERE rating IS NOT NULL
    GROUP BY 1, 2
    ON CONFLICT (tag, rating_band) DO UPDATE
      SET problem_count = EXCLUDED.problem_count,
          updated_at    = now();
    """
    try:
        # Supabase Python client doesn't have direct raw SQL execution.
        # So we can use the rest API to call an RPC or we can just fetch and compute in Python.
        # Let's compute in python and upsert.
        
        print("Fetching all rated problems to compute stats...")
        all_problems = []
        offset = 0
        while True:
            res = supabase.table("cf_problems").select("tags, rating").not_.is_("rating", "null").range(offset, offset + 1000).execute()
            if not res.data:
                break
            all_problems.extend(res.data)
            offset += 1000
            
        stats = {}
        for p in all_problems:
            rating = p["rating"]
            if rating < 1000: band = '800-1000'
            elif rating < 1200: band = '1000-1200'
            elif rating < 1400: band = '1200-1400'
            elif rating < 1600: band = '1400-1600'
            elif rating < 1800: band = '1600-1800'
            elif rating < 2000: band = '1800-2000'
            elif rating < 2200: band = '2000-2200'
            elif rating < 2400: band = '2200-2400'
            else: band = '2400+'
            
            for tag in p.get("tags", []):
                key = (tag, band)
                stats[key] = stats.get(key, 0) + 1
                
        records = [{"tag": t, "rating_band": b, "problem_count": c} for (t, b), c in stats.items()]
        print(f"Upserting {len(records)} stats records...")
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i+BATCH_SIZE]
            supabase.table("cf_topic_corpus_stats").upsert(batch, on_conflict="tag,rating_band").execute()
            
        print("cf_topic_corpus_stats populated")
        
    except Exception as e:
        print(f"Error populating corpus stats: {e}")


def main():
    print("=" * 60)
    print("  Codeforces Problem Catalog Ingestion")
    print("=" * 60)

    records = fetch_cf_problems()
    
    if not records:
        print("No records to insert. Exiting.")
        sys.exit(0)

    total = len(records)
    inserted = 0
    print(f"Upserting {total} records in batches of {BATCH_SIZE}...")

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        n = upsert_batch(batch)
        inserted += n
        pct = min(i + BATCH_SIZE, total)
        print(f"  [{pct}/{total}] batch done")

    print(f"Ingestion complete — {inserted} total problems upserted")
    
    populate_corpus_stats()


if __name__ == "__main__":
    main()
