CREATE TABLE public.cf_problem_solutions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    problem_id text NOT NULL,
    language text NOT NULL,
    code text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (problem_id, language)
);
