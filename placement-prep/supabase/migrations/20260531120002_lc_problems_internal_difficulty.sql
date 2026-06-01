ALTER TABLE public.lc_problems
  ADD COLUMN IF NOT EXISTS internal_difficulty SMALLINT
    CHECK (internal_difficulty IS NULL OR (internal_difficulty BETWEEN 1 AND 10));
