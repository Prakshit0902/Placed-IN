-- Execute this script in your Supabase SQL Editor

-- 1. Create lc_problems table
CREATE TABLE IF NOT EXISTS public.lc_problems (
    id INTEGER PRIMARY KEY, -- Maps to questionFrontendId
    internal_id INTEGER,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    difficulty TEXT,
    category TEXT,
    is_paid_only BOOLEAN DEFAULT FALSE,
    content TEXT,
    topic_tags TEXT[],
    hints TEXT[],
    example_testcases TEXT,
    similar_questions TEXT[],
    likes INTEGER,
    dislikes INTEGER,
    ac_rate TEXT,
    total_accepted TEXT,
    total_submission TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create lc_company_questions table
CREATE TABLE IF NOT EXISTS public.lc_company_questions (
    id SERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    problem_id INTEGER REFERENCES public.lc_problems(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT,
    difficulty TEXT,
    acceptance REAL,
    frequency REAL,
    windows TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company, problem_id)
);

-- 3. Add Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lc_problems_slug ON public.lc_problems(slug);
CREATE INDEX IF NOT EXISTS idx_lc_problems_difficulty ON public.lc_problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_lc_company_questions_company ON public.lc_company_questions(company);
CREATE INDEX IF NOT EXISTS idx_lc_company_questions_problem_id ON public.lc_company_questions(problem_id);
CREATE INDEX IF NOT EXISTS idx_lc_company_questions_frequency ON public.lc_company_questions(frequency DESC);

-- Enable RLS (Row Level Security) and allow public read access (assuming a public read-only app pattern)
ALTER TABLE public.lc_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_company_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on lc_problems" 
    ON public.lc_problems FOR SELECT USING (true);
    
CREATE POLICY "Allow public read access on lc_company_questions" 
    ON public.lc_company_questions FOR SELECT USING (true);
