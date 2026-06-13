const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(body.message || `API Error ${res.status}`);
  }

  return res.json();
}

// ---- Companies ----

export async function getCompanies() {
  return apiFetch<{ success: boolean; data: any[] }>('/api/companies');
}

export async function getCompanyProblems(name: string, page = 1) {
  return apiFetch<{ success: boolean; data: any[]; pagination: any }>(
    `/api/companies/${encodeURIComponent(name)}/problems?page=${page}`
  );
}

// ---- Sheets ----

export async function getGenericSheets() {
  return apiFetch<{ success: boolean; data: any[] }>('/api/sheets');
}

export async function getSheetPreview(id: string) {
  return apiFetch<{ success: boolean; data: any }>(`/api/sheets/${id}/preview`);
}

export async function getFullTemplate(id: string, token: string) {
  return apiFetch<{ success: boolean; data: any }>(`/api/sheets/${id}/full`, { token });
}

export async function getPersonalizedSheet(sheetId: string, token: string) {
  return apiFetch<{ success: boolean; data: any }>(`/api/sheets/personalized/${sheetId}`, { token });
}

// ---- Users ----

export async function getMe(token: string) {
  return apiFetch<{ success: boolean; data: any }>('/api/auth/me', { token });
}

export async function getMySheets(token: string) {
  return apiFetch<{ success: boolean; data: any[] }>('/api/users/sheets', { token });
}

export async function getDashboardStats(token: string) {
  return apiFetch<{ success: boolean; data: any }>('/api/users/dashboard', { token });
}

export async function generatePersonalizedSheet(
  token: string,
  body: { company: string; duration_days: number }
) {
  return apiFetch<{ success: boolean; data: any }>('/api/users/sheets/generate', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function generateDeepPersonalizedSheet(
  token: string,
  body: { company: string; duration_days: number }
) {
  return apiFetch<{ success: boolean; data: any }>('/api/users/sheets/generate/deep', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function setLeetcodeUsername(token: string, username: string) {
  return apiFetch<{ success: boolean }>('/api/users/leetcode-username', {
    method: 'POST',
    token,
    body: JSON.stringify({ username }),
  });
}

export async function updateProfile(token: string, body: { full_name?: string; leetcode_username?: string; cf_username?: string }) {
  return apiFetch<{ success: boolean }>('/api/users/profile', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export type LeetcodeSyncProblem = {
  slug: string;
  status?: 'SOLVED' | 'ATTEMPTED';
  solved_at?: string;
};

export async function syncLeetcodeData(
  token: string,
  payload: { problems: LeetcodeSyncProblem[] } | { solved_slugs: string[] }
) {
  return apiFetch<{ success: boolean; message: string; count?: number; solved_count?: number }>(
    '/api/users/leetcode/sync',
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }
  );
}

export async function syncLeetcodeRawChunk(token: string, submissions: any[]) {
  return apiFetch<{ success: boolean; message: string }>('/api/users/leetcode/sync-raw', {
    method: 'POST',
    token,
    body: JSON.stringify({ submissions }),
  });
}

export async function syncLeetcodeAggregate(token: string, timeframe?: string) {
  return apiFetch<{ success: boolean; message: string }>('/api/users/leetcode/sync-aggregate', {
    method: 'POST',
    token,
    body: timeframe ? JSON.stringify({ timeframe }) : undefined,
  });
}

export async function getLeetcodeSyncStatus(token: string) {
  return apiFetch<{ 
    success: boolean; 
    sync_level: string | null;
    last_synced_at: string | null;
    latest_timestamp: number | null;
    oldest_timestamp: number | null;
  }>('/api/users/leetcode/sync-status', { token });
}

export async function syncCodeforcesData(token: string) {
  return apiFetch<{ success: boolean; message: string }>('/api/user/codeforces/sync', {
    method: 'POST',
    token,
  });
}

// ---- Progress ----

export async function updateProgress(
  token: string,
  body: {
    sheet_id?: string;
    template_id?: string;
    week_number: number;
    question_id: number;
    status: string;
    time_spent_minutes?: number;
    notes?: string;
  }
) {
  return apiFetch<{ success: boolean }>('/api/progress/update', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

// ---- CP Sheets ----

export async function generateCpSheet(token: string, body: any) {
  return apiFetch<{ success: boolean; data?: any; message?: string }>('/api/user/cp-sheets/generate', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function getMyCpSheets(token: string) {
  return apiFetch<{ success: boolean; data: any[] }>('/api/user/cp-sheets', { token });
}

export async function getCpSheet(id: string, token: string) {
  return apiFetch<{ success: boolean; data: any }>(`/api/user/cp-sheets/${id}`, { token });
}

export async function updateCpProgress(
  id: string,
  problemId: string,
  token: string,
  status: string,
  notes?: string
) {
  return apiFetch<{ success: boolean }>('/api/user/cp-sheets/' + id + '/progress/' + problemId, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status, notes }),
  });
}

export async function getStreak(token: string) {
  return apiFetch<{ success: boolean; data: { current_streak: number; total_completed: number } }>(
    '/api/progress/streak',
    { token }
  );
}

export async function getSheetProgress(sheetId: string, token: string) {
  return apiFetch<{ success: boolean; data: any[] }>(`/api/progress/sheet/${sheetId}`, { token });
}

export async function getTemplateProgress(templateId: string, token: string) {
  return apiFetch<{ success: boolean; data: any[] }>(`/api/progress/template/${templateId}`, { token });
}

// ---- Billing ----

export async function createOrder(token: string, plan: string) {
  return apiFetch<{ success: boolean; order_id: string; amount: number; currency: string }>(
    '/api/billing/create-order',
    { method: 'POST', token, body: JSON.stringify({ plan }) }
  );
}

export async function verifyPayment(
  token: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  return apiFetch<{ success: boolean }>('/api/billing/verify', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function getSubscriptionStatus(token: string) {
  return apiFetch<{ success: boolean; data: any }>('/api/billing/subscription', { token });
}

// ---- Search (AI Service) ----

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://127.0.0.1:8000';

export async function getProblemById(id: number) {
  return apiFetch<{ success: boolean; data: any }>(`/api/problems/${id}`);
}



export async function searchProblems(query: string, limit = 20) {
  const res = await fetch(`${AI_SERVICE_URL}/api/query/search/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return {
    success: true,
    data: data.results || [],
    filters_extracted: data.filters_extracted,
    query_expansions: data.query_expansions || [],
  };
}

// ---- AI Problem Assistant ----

export interface QuotaError {
  quota_exhausted: true;
  message: string;
  used?: number;
  resets_at?: string;
  premium_required?: boolean;
}

/** Returns QuotaError instead of throwing when the server responds with 429. */
async function aiApiFetch<T>(
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<T | QuotaError> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429) {
    return (await res.json()) as QuotaError;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API Error: ${err}`);
  }
  const result = await res.json();
  return result.data as T;
}

export function isQuotaError(val: unknown): val is QuotaError {
  return typeof val === 'object' && val !== null && 'quota_exhausted' in val;
}

// Generate code (translate or generate from scratch)
export async function getProblemCode(
  problemId: number | string,
  language: string,
  token: string,
  platform: 'leetcode' | 'codeforces' = 'leetcode'
) {
  return aiApiFetch<{
    code: string;
    code_source: 'database' | 'llm_generated' | 'llm_translated' | 'scraped_cf';
  }>(`/api/problems/${problemId}/code`, token, { language, platform });
}

// Explanation: analogy + steps + dry run + (also returns code usually)
export async function getProblemExplanation(
  problemId: number | string,
  language: string,
  token: string,
  platform: 'leetcode' | 'codeforces' = 'leetcode'
) {
  return aiApiFetch<{
    analogy: string;
    approach_steps: string[];
    dry_run: { iteration: string; state: string; action: string }[];
    code: string;
    time_complexity: string;
    space_complexity: string;
    code_source: 'database' | 'llm_generated' | 'llm_translated' | 'scraped_cf';
  }>(`/api/problems/${problemId}/explain`, token, { language, platform });
}

// Progressive hints (level 1-3)
export async function getProblemHints(
  problemId: number | string,
  level: 1 | 2 | 3,
  token: string,
  platform: 'leetcode' | 'codeforces' = 'leetcode'
) {
  return aiApiFetch<{
    hint: string;
    level: number;
    is_final_hint: boolean;
  }>(`/api/problems/${problemId}/hints`, token, { level, platform });
}

// Complexity analysis
export async function getProblemComplexity(
  problemId: number | string,
  language: string,
  token: string,
  platform: 'leetcode' | 'codeforces' = 'leetcode'
) {
  return aiApiFetch<{
    time_complexity: string;
    space_complexity: string;
    line_by_line: string[];
    is_optimal: boolean;
    alternatives: { name: string; time_complexity: string; space_complexity: string; tradeoff: string }[];
  }>(`/api/problems/${problemId}/complexity`, token, { language, platform });
}

// Next problems to solve
export async function getSimilarProblems(problemId: number | string, token: string, platform: 'leetcode' | 'codeforces' = 'leetcode') {
  return aiApiFetch<{
    problems: string[];
    reasoning: string;
  }>(`/api/problems/${problemId}/similar`, token, { platform });
}
