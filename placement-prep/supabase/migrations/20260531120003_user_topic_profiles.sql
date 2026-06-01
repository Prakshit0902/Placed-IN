CREATE TABLE IF NOT EXISTS public.user_topic_profiles (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  proficiency_score REAL NOT NULL DEFAULT 0,
  effective_proficiency REAL NOT NULL DEFAULT 0,
  mastery_easy_pct REAL NOT NULL DEFAULT 0,
  mastery_med_pct REAL NOT NULL DEFAULT 0,
  mastery_hard_pct REAL NOT NULL DEFAULT 0,
  last_solved_at TIMESTAMPTZ,
  months_since_last_solve REAL,
  recency_multiplier REAL NOT NULL DEFAULT 1.0,
  preparation_tier TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, topic)
);
CREATE INDEX IF NOT EXISTS idx_utp_user ON public.user_topic_profiles(user_id);

CREATE TABLE IF NOT EXISTS public.topic_corpus_stats (
  topic TEXT PRIMARY KEY,
  total_weight REAL NOT NULL DEFAULT 0,
  easy_count INT NOT NULL DEFAULT 0,
  med_count INT NOT NULL DEFAULT 0,
  hard_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leetcode_user_problems
  ADD COLUMN IF NOT EXISTS attempt_count SMALLINT DEFAULT 1;
