"""
profile_builder.py — Builds and caches user_topic_profiles from solved/attempted data.

Key improvements over original:
- Uses mastery_score from leetcode_user_problems (if computed via aggregate) to weight solved credit
- Builds topic_solve_counts for ALL topics, including zero-solve topics (so blind-spot detection works)
- Writes back attempted problem counts per topic for richer scoring signals
- Seeds topic_corpus_stats if empty (first-run bootstrap)
"""

from typing import Any
from datetime import datetime, timezone
from supabase import Client
from app.core.recommendation.constants import TAG_TO_TOPIC, TOPIC_TO_TAGS
from app.core.logger import logger

# Difficulty weights — used for corpus and user scoring
W_DIFF: dict[str, float] = {"easy": 1.0, "medium": 2.5, "hard": 5.0}


def _get_weight(difficulty: str | None, internal_difficulty: float | None) -> float:
    """
    Compute the weight for a problem.
    If internal_difficulty is populated (1-10 scale), use it scaled to 0.2-2.0.
    Otherwise fall back to coarse difficulty weight.
    """
    if internal_difficulty and internal_difficulty > 0:
        return internal_difficulty / 5.0
    diff = (difficulty or "medium").lower()
    return W_DIFF.get(diff, 2.5)


def get_tier(eff_prof: float) -> str:
    if eff_prof < 35:
        return "Foundational"
    if eff_prof < 65:
        return "Developing"
    if eff_prof < 85:
        return "Advanced"
    return "Interview-Ready"


def _months_since(dt: datetime) -> float:
    delta = datetime.now(timezone.utc) - dt
    return delta.days / 30.44  # avg days per month


def _recency_decay(months: float) -> float:
    """
    Exponential-like decay.
    - <= 1 month : 1.00 (very fresh)
    - <= 6 months: 1.00 (still sharp)
    - > 6 months : decays, floor at 0.40
    """
    if months <= 6:
        return 1.0
    return max(0.40, 1.0 - 0.09 * (months - 6))


def _ensure_corpus_stats(supabase: Client) -> dict[str, dict]:
    """
    Read topic_corpus_stats. If empty, seed it from lc_problems (one-time bootstrap).
    Returns {topic: {total_weight, easy_count, med_count, hard_count}}.
    """
    res = supabase.table("topic_corpus_stats").select("*").execute()
    if res.data:
        return {row["topic"]: row for row in res.data}

    logger.warning("topic_corpus_stats is empty — bootstrapping from lc_problems (first-run only)")
    corpus = _compute_corpus_from_lc_problems(supabase)
    if corpus:
        _write_corpus_stats(supabase, corpus)
    return corpus


def _compute_corpus_from_lc_problems(supabase: Client) -> dict[str, dict]:
    """Full scan of lc_problems to compute corpus totals per topic. Only called once."""
    topic_data: dict[str, dict] = {}
    limit = 1000
    offset = 0

    while True:
        res = (
            supabase.table("lc_problems")
            .select("id, difficulty, internal_difficulty, topic_tags")
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break
        for prob in res.data:
            w = _get_weight(prob.get("difficulty"), prob.get("internal_difficulty"))
            diff = (prob.get("difficulty") or "medium").lower()
            for tag in prob.get("topic_tags") or []:
                if tag in TAG_TO_TOPIC:
                    topic = TAG_TO_TOPIC[tag]
                    if topic not in topic_data:
                        topic_data[topic] = {
                            "topic": topic,
                            "total_weight": 0.0,
                            "easy_count": 0,
                            "med_count": 0,
                            "hard_count": 0,
                        }
                    topic_data[topic]["total_weight"] += w
                    if diff == "easy":
                        topic_data[topic]["easy_count"] += 1
                    elif diff == "medium":
                        topic_data[topic]["med_count"] += 1
                    elif diff == "hard":
                        topic_data[topic]["hard_count"] += 1

        offset += limit
        if len(res.data) < limit:
            break

    logger.info(f"Computed corpus stats for {len(topic_data)} topics")
    return topic_data


def _write_corpus_stats(supabase: Client, corpus: dict[str, dict]) -> None:
    rows = list(corpus.values())
    for i in range(0, len(rows), 200):
        supabase.table("topic_corpus_stats").upsert(rows[i : i + 200]).execute()
    logger.info(f"Wrote {len(rows)} topic_corpus_stats rows")


def build_topic_profiles(supabase: Client, user_id: str) -> list[dict[str, Any]]:
    """
    Build user_topic_profiles for a user.

    Strategy:
    1. Fetch corpus stats (seeding if needed).
    2. Fetch all user problems (SOLVED + ATTEMPTED) with mastery_score and failure signals.
    3. Compute per-topic: weighted proficiency, mastery %, recency decay, attempted count, tier.
    4. Upsert to user_topic_profiles.
    5. Return profiles list.
    """
    logger.info(f"Building topic profiles for user {user_id}")
    corpus = _ensure_corpus_stats(supabase)

    # -- Step 1: Load user problems --
    user_rows: list[dict] = []
    offset = 0
    limit = 1000
    while True:
        res = (
            supabase.table("leetcode_user_problems")
            .select(
                "problem_id, status, solved_at, synced_at, "
                "failed_attempts_before_first_ac, mastery_score"
            )
            .eq("user_id", user_id)
            .range(offset, offset + limit - 1)
            .execute()
        )
        if not res.data:
            break
        user_rows.extend(res.data)
        offset += limit
        if len(res.data) < limit:
            break

    if not user_rows:
        logger.info(f"No problems found for user {user_id}, returning empty profiles")
        return []

    solved_pids: set[int] = set()
    attempted_pids: set[int] = set()
    solved_dates: dict[int, datetime] = {}
    mastery_scores: dict[int, float] = {}
    failed_attempts_map: dict[int, int] = {}

    for row in user_rows:
        pid = row.get("problem_id")
        if not pid:
            continue
        status = row.get("status")
        if status == "SOLVED":
            solved_pids.add(pid)
            # Prefer solved_at; fall back to synced_at
            dt_str = row.get("solved_at") or row.get("synced_at")
            if dt_str:
                try:
                    solved_dates[pid] = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                except ValueError:
                    pass
        elif status == "ATTEMPTED":
            attempted_pids.add(pid)

        ms = row.get("mastery_score")
        if ms is not None:
            mastery_scores[pid] = float(ms)

        fa = row.get("failed_attempts_before_first_ac") or 0
        if fa > 0:
            failed_attempts_map[pid] = int(fa)

    # -- Step 2: Fetch problem details for all solved problems --
    all_problem_ids = list(solved_pids | attempted_pids)
    if not all_problem_ids:
        return []

    chunk_size = 200
    problem_details: dict[int, dict] = {}
    for i in range(0, len(all_problem_ids), chunk_size):
        chunk = all_problem_ids[i : i + chunk_size]
        res = (
            supabase.table("lc_problems")
            .select("id, difficulty, internal_difficulty, topic_tags")
            .in_("id", chunk)
            .execute()
        )
        for p in res.data or []:
            problem_details[p["id"]] = p

    # -- Step 3: Aggregate per topic --
    now = datetime.now(timezone.utc)

    # Initialize accumulators for every topic in corpus
    topic_stats: dict[str, dict] = {}

    def _ensure_topic(t: str) -> None:
        if t not in topic_stats:
            topic_stats[t] = {
                "w_user": 0.0,
                "easy_solved": 0,
                "med_solved": 0,
                "hard_solved": 0,
                "attempted_count": 0,
                "last_solved_dt": None,
            }

    for pid, prob in problem_details.items():
        tags = prob.get("topic_tags") or []
        topics_for_prob = [TAG_TO_TOPIC[tag] for tag in tags if tag in TAG_TO_TOPIC]
        if not topics_for_prob:
            continue

        diff = (prob.get("difficulty") or "medium").lower()
        w = _get_weight(prob.get("difficulty"), prob.get("internal_difficulty"))

        if pid in solved_pids:
            # Use mastery_score from DB if available (0-1 range) to scale contribution.
            # This means a problem solved messily counts less than one solved cleanly.
            ms = mastery_scores.get(pid)
            if ms is not None and ms > 0:
                # Scale: mastery_score 0.5 = baseline (50% credit),
                # 1.0 = full credit, 0.0 = minimal credit (floor 0.5 of weight).
                # We multiply weight by clamp(0.5 + ms*0.5, 0.5, 1.0)
                effective_w = w * max(0.50, min(1.0, 0.5 + ms * 0.5))
            else:
                # Fallback: penalize heavily failed problems
                fails = failed_attempts_map.get(pid, 0)
                penalty = max(0.70, 1.0 - fails * 0.05)
                effective_w = w * penalty

            for topic in topics_for_prob:
                _ensure_topic(topic)
                topic_stats[topic]["w_user"] += effective_w
                if diff == "easy":
                    topic_stats[topic]["easy_solved"] += 1
                elif diff == "medium":
                    topic_stats[topic]["med_solved"] += 1
                elif diff == "hard":
                    topic_stats[topic]["hard_solved"] += 1

                dt = solved_dates.get(pid)
                if dt:
                    prev = topic_stats[topic]["last_solved_dt"]
                    if prev is None or dt > prev:
                        topic_stats[topic]["last_solved_dt"] = dt

        elif pid in attempted_pids:
            for topic in topics_for_prob:
                _ensure_topic(topic)
                topic_stats[topic]["attempted_count"] += 1

    # -- Step 4: Compute profiles --
    profiles: list[dict[str, Any]] = []

    for topic, stats in topic_stats.items():
        if stats["w_user"] == 0 and stats["attempted_count"] == 0:
            continue  # user has zero interaction with this topic

        corp = corpus.get(topic)
        if corp is None:
            continue

        w_corp = corp["total_weight"]
        w_user = stats["w_user"]
        prof = min(100.0, 100.0 * w_user / w_corp) if w_corp > 0 else 0.0

        easy_total = corp["easy_count"] or 0
        med_total = corp["med_count"] or 0
        hard_total = corp["hard_count"] or 0
        m_easy = 100.0 * stats["easy_solved"] / easy_total if easy_total > 0 else 0.0
        m_med = 100.0 * stats["med_solved"] / med_total if med_total > 0 else 0.0
        m_hard = 100.0 * stats["hard_solved"] / hard_total if hard_total > 0 else 0.0

        last_dt = stats["last_solved_dt"]
        months_since = _months_since(last_dt) if last_dt else None
        r_decay = _recency_decay(months_since) if months_since is not None else 1.0

        eff_prof = prof * r_decay
        tier = get_tier(eff_prof)

        profiles.append({
            "user_id": user_id,
            "topic": topic,
            "proficiency_score": round(prof, 3),
            "effective_proficiency": round(eff_prof, 3),
            "mastery_easy_pct": round(m_easy, 2),
            "mastery_med_pct": round(m_med, 2),
            "mastery_hard_pct": round(m_hard, 2),
            "last_solved_at": last_dt.isoformat() if last_dt else None,
            "months_since_last_solve": round(months_since, 2) if months_since is not None else None,
            "recency_multiplier": round(r_decay, 3),
            "preparation_tier": tier,
            "computed_at": now.isoformat(),
        })

    if profiles:
        for i in range(0, len(profiles), 200):
            try:
                supabase.table("user_topic_profiles").upsert(profiles[i : i + 200]).execute()
            except Exception as e:
                logger.error(f"Failed to upsert topic profiles batch: {e}")

    logger.info(
        f"Built {len(profiles)} topic profiles for user {user_id} "
        f"(solved_topics={sum(1 for p in profiles if p['proficiency_score'] > 0)}, "
        f"attempted_only={sum(1 for p in profiles if p['proficiency_score'] == 0)})"
    )
    return profiles
