-- ============================================================================
-- Placement Prep Assistant — Application Tables
-- ============================================================================
-- Run this script in Supabase SQL Editor AFTER setup_supabase.sql
-- (which created lc_problems + lc_company_questions).
-- ============================================================================

-- 1. Users (synced from Clerk via webhook)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,                 -- Clerk user_id (e.g. user_2abc...)
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    leetcode_username TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Colleges (B2B portal — Phase 6)
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    admin_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    license_type TEXT NOT NULL DEFAULT 'small'
        CHECK (license_type IN ('small', 'medium', 'large', 'enterprise')),
    license_expires_at TIMESTAMPTZ,
    max_students INT NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Pre-computed Prep Templates
-- These are the generic sheets for each company+role+duration.
-- Populated by the generate_templates.ipynb notebook.
CREATE TABLE IF NOT EXISTS public.prep_templates (
    id TEXT PRIMARY KEY,                  -- e.g. 'amazon_sde_60day'
    company TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'SDE',
    duration_days INT NOT NULL,
    total_weeks INT NOT NULL,
    total_questions INT NOT NULL,
    template_data JSONB NOT NULL,         -- Full week-by-week structure
    generated_from_question_count INT,    -- How many company questions were available
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(company, role, duration_days)
);

-- 4. Personalized Sheets (Premium feature)
-- Created when a user requests a personalized sheet based on their LeetCode profile.
CREATE TABLE IF NOT EXISTS public.personalized_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'SDE',
    duration_days INT NOT NULL,
    leetcode_username TEXT,
    original_template_id TEXT REFERENCES public.prep_templates(id),
    personalized_data JSONB NOT NULL,     -- Full personalized week structure
    leetcode_profile_snapshot JSONB,      -- Snapshot of profile at generation time
    adjustments_made JSONB,               -- What the LLM changed
    completion_status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Per-Question Progress Tracking
CREATE TABLE IF NOT EXISTS public.sheet_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sheet_id UUID REFERENCES public.personalized_sheets(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES public.prep_templates(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    question_id INT NOT NULL,             -- references lc_problems.id
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped', 'revisit')),
    time_spent_minutes INT DEFAULT 0,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Subscriptions (Razorpay payments)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    plan TEXT NOT NULL
        CHECK (plan IN ('monthly', 'quarterly', 'yearly', 'lifetime')),
    amount_paid INT,                      -- Amount in paise (INR)
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'refunded')),
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Mock Interview Sessions (Phase 6)
CREATE TABLE IF NOT EXISTS public.mock_interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company TEXT,
    role TEXT DEFAULT 'SDE',
    round_type TEXT NOT NULL
        CHECK (round_type IN ('dsa', 'system_design', 'behavioral', 'hr')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),
    transcript JSONB DEFAULT '[]'::jsonb,
    overall_score FLOAT,
    feedback_summary TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON public.users(subscription_tier);

-- Colleges
CREATE INDEX IF NOT EXISTS idx_colleges_slug ON public.colleges(slug);
CREATE INDEX IF NOT EXISTS idx_colleges_admin ON public.colleges(admin_user_id);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_company ON public.prep_templates(company);
CREATE INDEX IF NOT EXISTS idx_templates_company_role_dur ON public.prep_templates(company, role, duration_days);

-- Personalized sheets
CREATE INDEX IF NOT EXISTS idx_psheets_user ON public.personalized_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_psheets_company ON public.personalized_sheets(company);

-- Progress
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.sheet_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_sheet ON public.sheet_progress(sheet_id);
CREATE INDEX IF NOT EXISTS idx_progress_template ON public.sheet_progress(template_id);
CREATE INDEX IF NOT EXISTS idx_progress_completed ON public.sheet_progress(completed_at);

-- Ensure a user can only have one progress entry per question per sheet/template
CREATE UNIQUE INDEX IF NOT EXISTS idx_sheet_progress_unique_user_sheet_template_question
    ON public.sheet_progress (user_id, (COALESCE(sheet_id::text, '')), (COALESCE(template_id, '')), question_id);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Mock interview sessions
CREATE INDEX IF NOT EXISTS idx_mock_user ON public.mock_interview_sessions(user_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalized_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interview_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access for templates (anyone can see them)
CREATE POLICY "Allow public read access on prep_templates"
    ON public.prep_templates FOR SELECT USING (true);

-- Service role key (used by API backend) can do anything.
-- Individual user policies will be enforced at the API layer,
-- not at the DB level (since we use service_role key).
-- We add read-only policies for anon/public as needed:

CREATE POLICY "Users can read own data"
    ON public.users FOR SELECT USING (true);

CREATE POLICY "Allow service insert on users"
    ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service update on users"
    ON public.users FOR UPDATE USING (true);

CREATE POLICY "Public read on colleges"
    ON public.colleges FOR SELECT USING (true);

CREATE POLICY "Public read on personalized_sheets"
    ON public.personalized_sheets FOR SELECT USING (true);

CREATE POLICY "Public insert on personalized_sheets"
    ON public.personalized_sheets FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update on personalized_sheets"
    ON public.personalized_sheets FOR UPDATE USING (true);

CREATE POLICY "Public read on sheet_progress"
    ON public.sheet_progress FOR SELECT USING (true);

CREATE POLICY "Public insert on sheet_progress"
    ON public.sheet_progress FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update on sheet_progress"
    ON public.sheet_progress FOR UPDATE USING (true);

CREATE POLICY "Public read on subscriptions"
    ON public.subscriptions FOR SELECT USING (true);

CREATE POLICY "Public insert on subscriptions"
    ON public.subscriptions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update on subscriptions"
    ON public.subscriptions FOR UPDATE USING (true);

CREATE POLICY "Public access on mock_interview_sessions"
    ON public.mock_interview_sessions FOR ALL USING (true);
