from dataclasses import dataclass
from datetime import datetime
from typing import Any

from supabase import Client

from app.core.recommendation.constants import TAG_TO_TOPIC


@dataclass
class TopicProfile:
    topic: str
    proficiency_score: float
    effective_proficiency: float
    mastery_easy_pct: float
    mastery_med_pct: float
    mastery_hard_pct: float
    preparation_tier: str | None = None
    last_solved_at: datetime | None = None


class UserSkillModel:
    """
    Holds all per-user signals needed for scoring and week construction.

    Fields:
        profile             — raw LeetCode public profile (by_topic counts etc.)
        solved_problem_ids  — set of problem IDs the user has AC'd
        attempted_problem_ids — set of problem IDs with ATTEMPTED status
        topic_profiles      — cached user_topic_profiles rows keyed by topic
        problem_status      — {problem_id: "SOLVED" | "ATTEMPTED"}
        solved_at           — {problem_id: datetime} for SOLVED problems
        failed_attempts_before_ac — {problem_id: int}
        failure_types       — {problem_id: list[str]}
        has_resolved_after_gap — {problem_id: bool}
        attempt_counts      — {problem_id: int} total attempt count (≥ 1 for ATTEMPTED)
        topic_solve_counts  — {topic: int} raw solved count per topic (for blind-spot detection)
        topic_attempted_counts — {topic: int} raw attempted count per topic
    """

    def __init__(
        self,
        profile: dict[str, Any],
        solved_problem_ids: set[int] | None = None,
        attempted_problem_ids: set[int] | None = None,
        topic_profiles: dict[str, TopicProfile] | None = None,
        problem_status: dict[int, str] | None = None,
        solved_at: dict[int, datetime] | None = None,
        failed_attempts_before_ac: dict[int, int] | None = None,
        failure_types: dict[int, list[str]] | None = None,
        has_resolved_after_gap: dict[int, bool] | None = None,
        attempt_counts: dict[int, int] | None = None,
        topic_solve_counts: dict[str, int] | None = None,
        topic_attempted_counts: dict[str, int] | None = None,
    ):
        self.profile = profile
        self.solved_problem_ids = solved_problem_ids or set()
        self.attempted_problem_ids = attempted_problem_ids or set()
        self.topic_profiles = topic_profiles or {}
        self.problem_status = problem_status or {}
        self.solved_at = solved_at or {}
        self.failed_attempts_before_ac = failed_attempts_before_ac or {}
        self.failure_types = failure_types or {}
        self.has_resolved_after_gap = has_resolved_after_gap or {}
        self.attempt_counts = attempt_counts or {}
        self.topic_solve_counts = topic_solve_counts or {}
        self.topic_attempted_counts = topic_attempted_counts or {}

    # ── Constructors ──────────────────────────────────────────────────────────

    @classmethod
    def from_profile_only(cls, profile: dict[str, Any]) -> "UserSkillModel":
        """
        Basic mode: build from public LeetCode profile (topic solve counts only).
        No DB look-up. Used when user hasn't connected the extension yet.
        """
        topic_counts: dict[str, int] = {}
        for tag_name, count in (profile.get("by_topic") or {}).items():
            slug = tag_name.lower().replace(" ", "-")
            topic = TAG_TO_TOPIC.get(slug, slug)
            topic_counts[topic] = topic_counts.get(topic, 0) + int(count)
        return cls(profile=profile, topic_solve_counts=topic_counts)

    @classmethod
    def from_db(cls, supabase: Client, user_id: str, profile: dict[str, Any]) -> "UserSkillModel":
        """
        Deep mode: load all user signals from DB:
         - leetcode_user_problems (SOLVED + ATTEMPTED, with all metadata)
         - user_topic_profiles (cached proficiency)
        """
        solved_ids: set[int] = set()
        attempted_ids: set[int] = set()
        problem_status: dict[int, str] = {}
        solved_at: dict[int, datetime] = {}
        failed_attempts_before_ac: dict[int, int] = {}
        failure_types: dict[int, list[str]] = {}
        has_resolved_after_gap: dict[int, bool] = {}
        attempt_counts: dict[int, int] = {}
        topic_solve_counts: dict[str, int] = {}
        topic_attempted_counts: dict[str, int] = {}

        offset = 0
        limit = 1000
        while True:
            res = (
                supabase.table("leetcode_user_problems")
                .select(
                    "problem_id, status, solved_at, topics, "
                    "failed_attempts_before_first_ac, failure_types, "
                    "has_resolved_after_gap, attempt_count"
                )
                .eq("user_id", user_id)
                .range(offset, offset + limit - 1)
                .execute()
            )
            if not res.data:
                break

            for row in res.data:
                pid = row.get("problem_id")
                if not pid:
                    continue

                status = row.get("status")
                problem_status[pid] = status

                # Attempt count (defaults to 1 for SOLVED, actual count for ATTEMPTED)
                ac = row.get("attempt_count") or 0
                attempt_counts[pid] = max(1, int(ac))

                if status == "SOLVED":
                    solved_ids.add(pid)
                    dt_str = row.get("solved_at")
                    if dt_str:
                        try:
                            solved_at[pid] = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                        except ValueError:
                            pass
                    # Accumulate per-topic solve counts
                    for tag in row.get("topics") or []:
                        if tag in TAG_TO_TOPIC:
                            t = TAG_TO_TOPIC[tag]
                            topic_solve_counts[t] = topic_solve_counts.get(t, 0) + 1

                elif status == "ATTEMPTED":
                    attempted_ids.add(pid)
                    # Accumulate per-topic attempted counts
                    for tag in row.get("topics") or []:
                        if tag in TAG_TO_TOPIC:
                            t = TAG_TO_TOPIC[tag]
                            topic_attempted_counts[t] = topic_attempted_counts.get(t, 0) + 1

                fa = row.get("failed_attempts_before_first_ac") or 0
                if fa > 0:
                    failed_attempts_before_ac[pid] = int(fa)

                ft = row.get("failure_types")
                if ft:
                    failure_types[pid] = ft

                gap = row.get("has_resolved_after_gap")
                if gap:
                    has_resolved_after_gap[pid] = True

            offset += limit
            if len(res.data) < limit:
                break

        # Load cached topic profiles
        res_prof = (
            supabase.table("user_topic_profiles")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        topic_profiles: dict[str, TopicProfile] = {}
        for p in res_prof.data or []:
            dt = None
            if p.get("last_solved_at"):
                try:
                    dt = datetime.fromisoformat(p["last_solved_at"].replace("Z", "+00:00"))
                except ValueError:
                    pass
            tp = TopicProfile(
                topic=p["topic"],
                proficiency_score=p["proficiency_score"],
                effective_proficiency=p["effective_proficiency"],
                mastery_easy_pct=p["mastery_easy_pct"],
                mastery_med_pct=p["mastery_med_pct"],
                mastery_hard_pct=p["mastery_hard_pct"],
                preparation_tier=p.get("preparation_tier"),
                last_solved_at=dt,
            )
            topic_profiles[tp.topic] = tp

        # If no cached topic profiles, fall back to public profile counts
        if not topic_profiles and profile.get("by_topic"):
            return cls.from_profile_only(profile)

        return cls(
            profile=profile,
            solved_problem_ids=solved_ids,
            attempted_problem_ids=attempted_ids,
            topic_profiles=topic_profiles,
            problem_status=problem_status,
            solved_at=solved_at,
            failed_attempts_before_ac=failed_attempts_before_ac,
            failure_types=failure_types,
            has_resolved_after_gap=has_resolved_after_gap,
            attempt_counts=attempt_counts,
            topic_solve_counts=topic_solve_counts,
            topic_attempted_counts=topic_attempted_counts,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def has_solved(self, problem_id: int) -> bool:
        return problem_id in self.solved_problem_ids

    def topic_coverage(self, topic: str) -> int:
        """
        Return the number of problems the user has solved in a topic.
        Checks topic_profiles first (richer), then raw topic_solve_counts.
        """
        if topic in self.topic_profiles:
            tp = self.topic_profiles[topic]
            # Use actual solve counts from topic_solve_counts if available,
            # otherwise use effective_proficiency as a proxy signal.
            if topic in self.topic_solve_counts:
                return self.topic_solve_counts[topic]
            return 1 if tp.effective_proficiency > 0 else 0
        return self.topic_solve_counts.get(topic, 0)

    def topic_attempted_count(self, topic: str) -> int:
        return self.topic_attempted_counts.get(topic, 0)

    def get_effective_proficiency(self, topic: str) -> float:
        """Return effective proficiency (0-100) for a topic, 0 if not seen."""
        if topic in self.topic_profiles:
            return self.topic_profiles[topic].effective_proficiency
        return 0.0
