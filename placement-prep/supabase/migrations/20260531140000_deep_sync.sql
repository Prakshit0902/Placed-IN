-- Add deep sync submission history columns to leetcode_user_problems
ALTER TABLE public.leetcode_user_problems
ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_attempts_before_first_ac INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_types JSONB,
ADD COLUMN IF NOT EXISTS has_resolved_after_gap BOOLEAN DEFAULT FALSE;
