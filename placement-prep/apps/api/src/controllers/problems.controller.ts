import { Context } from "hono"
import { supabase } from "../lib/supabase.js"

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000"
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY ?? ""

// ── Quota constants ──────────────────────────────────────────────────────────
const FREE_DAILY_QUOTA = 20

type QuotaFeature = "explain" | "translate" | "hints_l3" | "complexity"

/**
 * Checks and consumes one quota slot for a free user.
 * Premium/enterprise users bypass quota entirely.
 * Returns { allowed: true } or { allowed: false, resets_at: ISO string, used: number }
 */
async function checkAndConsumeQuota(
  userId: string,
  feature: QuotaFeature
): Promise<{ allowed: boolean; used?: number; resets_at?: string; tier: string }> {
  // Check user tier first
  const { data: user } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", userId)
    .single()

  const tier = user?.subscription_tier || "free"

  if (tier !== "free") {
    return { allowed: true, tier }
  }

  // Count today's usage across ALL gated features (shared pool)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from("ai_usage_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("used_at", todayStart.toISOString())

  const used = count ?? 0

  if (used >= FREE_DAILY_QUOTA) {
    // Calculate tomorrow midnight for reset time
    const tomorrow = new Date(todayStart)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return {
      allowed: false,
      used,
      resets_at: tomorrow.toISOString(),
    }
  }

  // Consume one slot
  await supabase.from("ai_usage_log").insert({ user_id: userId, feature })

  return { allowed: true, used: used + 1, tier }
}

/**
 * Proxy call to the Python AI service with the internal service key.
 */
async function callAiService<T>(
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "GET" = "POST"
): Promise<T> {
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INTERNAL_KEY}`,
    },
  }
  if (method === "POST") {
    fetchOptions.body = JSON.stringify(body)
  }
  const res = await fetch(`${AI_SERVICE_URL}${path}`, fetchOptions)

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI service error (${res.status}): ${err}`)
  }

  return res.json() as Promise<T>
}

// ── getProblems (existing) ───────────────────────────────────────────────────

export const getProblems = async (c: Context) => {
  const page = c.req.param("page")
  const PAGE_SIZE = 10

  const offset = (Number(page) - 1) * PAGE_SIZE
  const limit = offset + PAGE_SIZE - 1
  const data = await supabase
    .from("lc_problems")
    .select("*")
    .order("id", { ascending: true })
    .range(offset, limit)

  if (!data) {
    return c.json({ success: false, message: "Failed to fetch problems" }, 500)
  }

  return c.json({ success: true, data })
}

// ── getProblemById ────────────────────────────────────────────────────────────

export const getProblemById = async (c: Context) => {
  const rawId = c.req.param("id")
  const problemId = Number(rawId)

  if (!rawId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  const { data, error } = await supabase
    .from("lc_problems")
    .select("id, title, slug, difficulty, content, topic_tags, hints, example_testcases")
    .eq("id", problemId)
    .single()

  if (error || !data) {
    console.log(error);
    
    return c.json({ success: false, message: "Problem not found" }, 404)
  }

  // Attach available solution languages (for the code tab)
  const { data: langs } = await supabase
    .from("lc_problem_solutions")
    .select("language")
    .eq("problem_id", problemId)

  return c.json({
    success: true,
    data: {
      ...data,
      available_languages: (langs || []).map((r: any) => r.language),
    },
  })
}



// ── getProblemCode ─────────────────────────────────────────────────────────────

export const getProblemCode = async (c: Context) => {
  const userId = c.get("userId")
  const problemId = Number(c.req.param("id"))

  if (!problemId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  let body: { language?: string } = {}
  try {
    body = await c.req.json()
  } catch (_) {}

  const language = body.language ?? "python"

  // Code generation/fetching shares the explain quota
  const feature: QuotaFeature = "explain"
  const quota = await checkAndConsumeQuota(userId, feature)

  if (!quota.allowed) {
    return c.json(
      {
        success: false,
        quota_exhausted: true,
        message: `Daily AI limit reached (${FREE_DAILY_QUOTA} uses/day). Upgrade to Premium for unlimited access.`,
        used: quota.used,
        resets_at: quota.resets_at,
      },
      429
    )
  }

  try {
    const result = await callAiService("/api/query/explain/code", {
      problem_id: problemId,
      language,
      tier: quota.tier,
    })
    return c.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Code error:", error.message)
    return c.json({ success: false, message: "AI service error" }, 502)
  }
}

// ── getProblemExplanation ────────────────────────────────────────────────────

export const getProblemExplanation = async (c: Context) => {
  const userId = c.get("userId")
  const problemId = Number(c.req.param("id"))

  if (!problemId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  let body: { language?: string } = {}
  try {
    body = await c.req.json()
  } catch (_) {}

  const language = body.language ?? "python"

  // Quota check (explain & translate share the same pool)
  const feature: QuotaFeature = "explain"
  const quota = await checkAndConsumeQuota(userId, feature)

  if (!quota.allowed) {
    return c.json(
      {
        success: false,
        quota_exhausted: true,
        message: `Daily AI limit reached (${FREE_DAILY_QUOTA} uses/day). Upgrade to Premium for unlimited access.`,
        used: quota.used,
        resets_at: quota.resets_at,
      },
      429
    )
  }

  try {
    const result = await callAiService("/api/query/explain/solution", {
      problem_id: problemId,
      language,
      tier: quota.tier,
    })
    return c.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Explanation error:", error.message)
    return c.json({ success: false, message: "AI service error" }, 502)
  }
}

// ── getProblemHints ──────────────────────────────────────────────────────────

export const getProblemHints = async (c: Context) => {
  const userId = c.get("userId")
  const problemId = Number(c.req.param("id"))

  if (!problemId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  let body: { level?: number } = {}
  try {
    body = await c.req.json()
  } catch (_) {}

  const level = body.level ?? 1

  if (level < 1 || level > 3) {
    return c.json({ success: false, message: "Level must be 1, 2, or 3" }, 400)
  }

  let tier = "free"
  if (level === 3) {
    const quota = await checkAndConsumeQuota(userId, "hints_l3")
    if (!quota.allowed) {
      return c.json(
        {
          success: false,
          quota_exhausted: true,
          premium_required: true,
          message: "Level 3 hints require a Premium subscription.",
          resets_at: quota.resets_at,
        },
        429
      )
    }
    tier = quota.tier
  } else {
    const { data: user } = await supabase
      .from("users")
      .select("subscription_tier")
      .eq("id", userId)
      .single()
    tier = user?.subscription_tier || "free"
  }

  try {
    const result = await callAiService("/api/query/explain/hints", {
      problem_id: problemId,
      level,
      tier,
    })
    return c.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Hints error:", error.message)
    return c.json({ success: false, message: "AI service error" }, 502)
  }
}

// ── getProblemComplexity ─────────────────────────────────────────────────────

export const getProblemComplexity = async (c: Context) => {
  const userId = c.get("userId")
  const problemId = Number(c.req.param("id"))

  if (!problemId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  let body: { language?: string } = {}
  try {
    body = await c.req.json()
  } catch (_) {}

  const language = body.language ?? "python"

  const quota = await checkAndConsumeQuota(userId, "complexity")

  if (!quota.allowed) {
    return c.json(
      {
        success: false,
        quota_exhausted: true,
        message: `Daily AI limit reached (${FREE_DAILY_QUOTA} uses/day). Upgrade to Premium for unlimited access.`,
        used: quota.used,
        resets_at: quota.resets_at,
      },
      429
    )
  }

  try {
    const result = await callAiService("/api/query/explain/complexity", {
      problem_id: problemId,
      language,
      tier: quota.tier,
    })
    return c.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Complexity error:", error.message)
    return c.json({ success: false, message: "AI service error" }, 502)
  }
}

// ── getSimilarProblems ───────────────────────────────────────────────────────

export const getSimilarProblems = async (c: Context) => {
  const problemId = Number(c.req.param("id"))

  if (!problemId || isNaN(problemId)) {
    return c.json({ success: false, message: "Invalid problem ID" }, 400)
  }

  // Similar problems is free — no quota needed
  const userId = c.get("userId")
  const { data: user } = await supabase.from("users").select("subscription_tier").eq("id", userId).single()
  const tier = user?.subscription_tier || "free"

  try {
    const result = await callAiService("/api/query/explain/similar", {
      problem_id: problemId,
      tier,
    })
    return c.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Similar problems error:", error.message)
    return c.json({ success: false, message: "AI service error" }, 502)
  }
}