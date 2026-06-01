ALTER TABLE public.personalized_sheets
  ADD COLUMN IF NOT EXISTS readiness_score JSONB,
  ADD COLUMN IF NOT EXISTS plan_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS week_question_ids JSONB;
