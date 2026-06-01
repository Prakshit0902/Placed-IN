-- Table: leetcode_submissions (Raw Layer)
CREATE TABLE IF NOT EXISTS public.leetcode_submissions (
  id                BIGINT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug      TEXT NOT NULL,
  problem_id        INT,
  status_code       INT NOT NULL,
  status_display    TEXT NOT NULL,
  language          TEXT NOT NULL,
  runtime_ms        INT,
  memory_mb         REAL,
  submitted_at      TIMESTAMPTZ NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_ls_user_slug    ON public.leetcode_submissions(user_id, problem_slug);
CREATE INDEX IF NOT EXISTS idx_ls_user_time    ON public.leetcode_submissions(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ls_user_status  ON public.leetcode_submissions(user_id, status_code);
CREATE INDEX IF NOT EXISTS idx_ls_problem_id   ON public.leetcode_submissions(problem_id) WHERE problem_id IS NOT NULL;

-- Table: leetcode_problem_stats (Derived Layer)
CREATE TABLE IF NOT EXISTS public.leetcode_problem_stats (
  user_id                     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug                TEXT NOT NULL,
  problem_id                  INT,
  final_status                TEXT NOT NULL,
  first_attempted_at          TIMESTAMPTZ,
  first_solved_at             TIMESTAMPTZ,
  last_attempted_at           TIMESTAMPTZ,
  last_solved_at              TIMESTAMPTZ,
  days_to_first_solve         REAL,
  total_submissions           SMALLINT NOT NULL DEFAULT 0,
  accepted_count              SMALLINT NOT NULL DEFAULT 0,
  failed_before_first_ac      SMALLINT NOT NULL DEFAULT 0,
  solved_on_first_try         BOOLEAN NOT NULL DEFAULT FALSE,
  wrong_answer_count          SMALLINT NOT NULL DEFAULT 0,
  tle_count                   SMALLINT NOT NULL DEFAULT 0,
  mle_count                   SMALLINT NOT NULL DEFAULT 0,
  runtime_error_count         SMALLINT NOT NULL DEFAULT 0,
  compile_error_count         SMALLINT NOT NULL DEFAULT 0,
  was_revisited               BOOLEAN NOT NULL DEFAULT FALSE,
  revisit_count               SMALLINT NOT NULL DEFAULT 0,
  solved_after_gap            BOOLEAN NOT NULL DEFAULT FALSE,
  best_runtime_ms             INT,
  worst_runtime_ms            INT,
  avg_runtime_ms              REAL,
  languages_used              TEXT[] NOT NULL DEFAULT '{}',
  primary_language            TEXT,
  mastery_score               REAL,
  mastery_computed_at         TIMESTAMPTZ,
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (user_id, problem_slug)
);

CREATE INDEX IF NOT EXISTS idx_lps_user         ON public.leetcode_problem_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_lps_user_status  ON public.leetcode_problem_stats(user_id, final_status);
CREATE INDEX IF NOT EXISTS idx_lps_first_solved ON public.leetcode_problem_stats(user_id, first_solved_at DESC);
CREATE INDEX IF NOT EXISTS idx_lps_mastery      ON public.leetcode_problem_stats(user_id, mastery_score);

-- Modify leetcode_user_problems to link the stats
ALTER TABLE public.leetcode_user_problems
  ADD COLUMN IF NOT EXISTS first_solved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_solved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_before_ac   SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mastery_score      REAL;

-- Add RLS to leetcode_submissions
ALTER TABLE public.leetcode_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own submissions" 
  ON public.leetcode_submissions FOR SELECT 
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage submissions" 
  ON public.leetcode_submissions FOR ALL 
  USING (auth.role() = 'service_role');

-- Add RLS to leetcode_problem_stats
ALTER TABLE public.leetcode_problem_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own problem stats" 
  ON public.leetcode_problem_stats FOR SELECT 
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can manage problem stats" 
  ON public.leetcode_problem_stats FOR ALL 
  USING (auth.role() = 'service_role');
