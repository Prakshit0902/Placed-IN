#!/usr/bin/env python3
"""
ingest_solutions.py
--------------------
Scans the LeetCode solution git repository and batch-upserts all
multi-language code solutions into Supabase `lc_problem_solutions`.

Run from project root:
    python services/ingestion/ingest_solutions.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in services/ingestion/.env
"""

import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Config ─────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
assert SUPABASE_URL and SUPABASE_KEY, "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env"

SOLUTION_ROOT = Path(r"C:/PRAKSHIT/VS CODE/Prep Assistant Project/placed_in/data/leetcode/solution")
BATCH_SIZE = 200

# Extension → canonical language name stored in DB
EXT_TO_LANG: dict[str, str] = {
    ".py":    "python",
    ".java":  "java",
    ".cpp":   "cpp",
    ".ts":    "typescript",
    ".js":    "javascript",
    ".go":    "go",
    ".rs":    "rust",
    ".cs":    "csharp",
    ".kt":    "kotlin",
    ".rb":    "ruby",
    ".php":   "php",
    ".swift": "swift",
    ".scala": "scala",
    ".c":     "c",
    ".nim":   "nim",
    ".cj":    "cangjie",
}

# Regex to pull the problem number from folder name like "0001.Two Sum"
PROBLEM_NUM_RE = re.compile(r"^(\d{4})\.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def build_problem_id_map() -> set[int]:
    """Fetches ALL lc_problems IDs, paginating through Supabase's 1000-row limit."""
    print("Building problem ID map from Supabase...")
    ids: set[int] = set()
    PAGE = 1000
    offset = 0
    while True:
        result = supabase.table("lc_problems").select("id").range(offset, offset + PAGE - 1).execute()
        batch = result.data or []
        for row in batch:
            ids.add(row["id"])
        if len(batch) < PAGE:
            break  # last page
        offset += PAGE
    print(f"  -> {len(ids)} problems found in DB")
    return ids


def collect_solutions(valid_ids: set[int]) -> list[dict]:
    """Walks every range folder, reads all Solution.* files, returns records."""
    records: list[dict] = []
    skipped_missing = 0
    skipped_ext = 0

    range_dirs = sorted(d for d in SOLUTION_ROOT.iterdir() if d.is_dir() and re.match(r"^\d{4}-\d{4}$", d.name))

    for range_dir in range_dirs:
        for problem_dir in sorted(range_dir.iterdir()):
            if not problem_dir.is_dir():
                continue

            m = PROBLEM_NUM_RE.match(problem_dir.name)
            if not m:
                continue

            problem_num = int(m.group(1))
            if problem_num not in valid_ids:
                skipped_missing += 1
                continue

            for sol_file in problem_dir.iterdir():
                if not sol_file.name.startswith("Solution"):
                    continue

                ext = sol_file.suffix.lower()
                lang = EXT_TO_LANG.get(ext)
                if not lang:
                    skipped_ext += 1
                    continue

                try:
                    code = sol_file.read_text(encoding="utf-8", errors="replace").strip()
                except Exception as e:
                    print(f"  ✗ Could not read {sol_file}: {e}")
                    continue

                if not code:
                    continue

                records.append({
                    "problem_id": problem_num,
                    "language":   lang,
                    "code":       code,
                })

    print(f"  -> Collected {len(records)} solution files (before dedup)")
    print(f"  -> Skipped (problem not in DB): {skipped_missing}")
    print(f"  -> Skipped (unknown extension): {skipped_ext}")

    # Deduplicate: keep the longest code for each (problem_id, language) pair.
    # Some repos have Solution.py + Solution2.py for the same problem.
    best: dict[tuple[int, str], dict] = {}
    for rec in records:
        key = (rec["problem_id"], rec["language"])
        if key not in best or len(rec["code"]) > len(best[key]["code"]):
            best[key] = rec
    records = list(best.values())
    print(f"  -> {len(records)} unique (problem_id, language) pairs after dedup")
    return records


def upsert_batch(records: list[dict]) -> int:
    """Upserts a batch of solution records. Returns count of successful rows."""
    res = (
        supabase.table("lc_problem_solutions")
        .upsert(records, on_conflict="problem_id,language")
        .execute()
    )
    return len(res.data) if res.data else 0


def main():
    print("=" * 60)
    print("  LeetCode Solution Ingestion")
    print("=" * 60)

    valid_ids = build_problem_id_map()
    print()

    print("Scanning solution directory...")
    records = collect_solutions(valid_ids)
    print()

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
        print(f"  [{pct}/{total}] batch done ({n} rows upserted)")

    print()
    print(f"✅ Ingestion complete — {inserted} total rows upserted into lc_problem_solutions")


if __name__ == "__main__":
    main()
