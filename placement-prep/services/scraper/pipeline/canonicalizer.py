from rapidfuzz import fuzz
from supabase import create_client, Client
from config import config
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class SupabaseCanonicalizer:
    """
    Manages resolving and storing scraped questions into a unified
    `canonical_problems` table in Supabase.
    """

    MATCH_THRESHOLD = 85.0 # rapidfuzz similarity threshold out of 100

    def __init__(self):
        # We assume the config variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
        if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("[Canonicalizer] Supabase credentials are not set in config.")
            
        self.supabase: Client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE_KEY
        )

        # Basic cache to reduce identical title lookups within a single run
        self._cache = {}

    def fetch_candidates_by_title(self, raw_title: str) -> list[dict]:
        """
        Fetch all canonical problems that share the exact first 3 letters 
        to narrow down the pool (a very naive but fast filter for text search).
        """
        prefix = raw_title[:3].strip()
        if len(prefix) < 3:
            # If too short, just fetch all or return empty pool.
            # We'll just run a query fetching limited rows.
            result = self.supabase.table("canonical_problems").select("*").limit(200).execute()
            return result.data

        # ILIKE match on prefix
        result = self.supabase.table("canonical_problems").select("*").ilike("canonical_name", f"{prefix}%").execute()
        return result.data 
        
    def resolve_canonical_id(self, raw_title: str, source_url: str, raw_data: dict) -> str:
        """
        Returns the Canonical ID (UUID string).
        Workflow:
        1. Exact URL Match in `problem_source_mappings`.
        2. Fuzzy Match against `canonical_problems`.
        3. Insert new row if no match.
        """
        raw_title = raw_title.strip()
        source = raw_data.get("source", "GFG")

        # 1. Check mapping table cache/DB
        if source_url in self._cache:
            return self._cache[source_url]

        mapping_res = self.supabase.table("problem_source_mappings").select("canonical_id").eq("source_url", source_url).execute()
        if mapping_res.data:
            c_id = mapping_res.data[0]["canonical_id"]
            self._cache[source_url] = c_id
            return c_id

        # 2. Fuzzy Match
        candidates = self.fetch_candidates_by_title(raw_title)
        best_score = 0.0
        best_id = None

        for cand in candidates:
            score = fuzz.token_sort_ratio(raw_title.lower(), cand["canonical_name"].lower())
            if score > best_score:
                best_score = score
                best_id = cand["id"]

        if best_id and best_score >= self.MATCH_THRESHOLD:
            # Found a match, create mapping
            self._create_mapping(best_id, source, source_url, raw_title)
            self._cache[source_url] = best_id
            return best_id

        # 3. Create new Canonical Problem
        import uuid
        topic_array = raw_data.get("topics", [])
        difficulty = raw_data.get("difficulty", "MEDIUM").upper()

        new_prob_res = self.supabase.table("canonical_problems").insert({
            "id": str(uuid.uuid4()),
            "canonical_name": raw_title,
            "difficulty": difficulty,
            "topics": topic_array
        }).execute()

        if new_prob_res.data:
            new_id = new_prob_res.data[0]["id"]
            
            # Create mapping
            self._create_mapping(new_id, source, source_url, raw_title)
            self._cache[source_url] = new_id
            return new_id
        else:
            raise Exception(f"[Canonicalizer] Failed to insert new problem for {raw_title}")

    def _create_mapping(self, canonical_id: str, source: str, source_url: str, original_title: str):
        import uuid
        self.supabase.table("problem_source_mappings").insert({
            "id": str(uuid.uuid4()),
            "canonical_id": canonical_id,
            "source": source.lower() if source else "gfg",
            "source_url": source_url
        }).execute()
