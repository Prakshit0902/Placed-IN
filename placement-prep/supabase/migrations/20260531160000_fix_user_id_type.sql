-- Drop constraints
ALTER TABLE public.leetcode_submissions DROP CONSTRAINT IF EXISTS leetcode_submissions_user_id_fkey;
ALTER TABLE public.leetcode_problem_stats DROP CONSTRAINT IF EXISTS leetcode_problem_stats_user_id_fkey;

-- Change types to TEXT
ALTER TABLE public.leetcode_submissions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.leetcode_problem_stats ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Add new constraints
ALTER TABLE public.leetcode_submissions ADD CONSTRAINT leetcode_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.leetcode_problem_stats ADD CONSTRAINT leetcode_problem_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
