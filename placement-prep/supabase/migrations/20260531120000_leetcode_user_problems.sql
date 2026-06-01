CREATE TABLE public.leetcode_user_problems (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_slug TEXT NOT NULL,
  problem_id INTEGER REFERENCES public.lc_problems(id),
  difficulty TEXT,
  topics TEXT[],
  status TEXT NOT NULL DEFAULT 'SOLVED'
    CHECK (status IN ('SOLVED', 'ATTEMPTED')),
  solved_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, problem_slug)
);

CREATE INDEX idx_lup_user ON public.leetcode_user_problems(user_id);
CREATE INDEX idx_lup_user_problem_id ON public.leetcode_user_problems(user_id, problem_id);

ALTER TABLE public.leetcode_user_problems ENABLE ROW LEVEL SECURITY;
