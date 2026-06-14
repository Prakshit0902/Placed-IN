import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

type SyncProblemInput = {
  slug: string;
  status?: 'SOLVED' | 'ATTEMPTED';
  solved_at?: string;
  last_attempted_at?: string;
  failed_attempts_before_first_ac?: number;
  total_attempts?: number;
  failure_types?: string[];
  has_resolved_after_gap?: boolean;
};

function normalizeSyncPayload(body: Record<string, unknown>): SyncProblemInput[] {
  const fromProblems = Array.isArray(body.problems)
    ? (body.problems as SyncProblemInput[])
        .filter((p) => p && typeof p.slug === 'string' && p.slug.length > 0)
        .map((p) => ({
          slug: p.slug,
          status: (p.status === 'ATTEMPTED' ? 'ATTEMPTED' : 'SOLVED') as 'SOLVED' | 'ATTEMPTED',
          solved_at: p.solved_at,
          last_attempted_at: p.last_attempted_at,
          failed_attempts_before_first_ac: p.failed_attempts_before_first_ac,
          total_attempts: p.total_attempts,
          failure_types: p.failure_types,
          has_resolved_after_gap: p.has_resolved_after_gap,
        }))
    : [];

  if (fromProblems.length > 0) {
    return fromProblems;
  }

  if (Array.isArray(body.solved_slugs)) {
    return (body.solved_slugs as string[])
      .filter((slug) => typeof slug === 'string' && slug.length > 0)
      .map((slug) => ({
        slug,
        status: 'SOLVED' as const,
      }));
  }

  return [];
}

async function fetchProblemsBySlugs(slugs: string[]) {
  const slugToProblem = new Map<string, { id: number; difficulty: string | null; topic_tags: string[] | null }>();
  const chunkSize = 500;

  for (let i = 0; i < slugs.length; i += chunkSize) {
    const chunk = slugs.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('lc_problems')
      .select('id, slug, difficulty, topic_tags')
      .in('slug', chunk);

    if (error) throw error;
    for (const row of data || []) {
      slugToProblem.set(row.slug, {
        id: row.id,
        difficulty: row.difficulty,
        topic_tags: row.topic_tags,
      });
    }
  }

  return slugToProblem;
}

export const getMySheets = async (c: Context) => {
  const userId = c.get('userId');

  try {
    const { data: personalizedSheets, error: pError } = await supabase
      .from('personalized_sheets')
      .select('id, company, role, duration_days, completion_status, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (pError) throw pError;

    const formattedPersonalized = (personalizedSheets || []).map((s: { id: string }) => ({
      ...s,
      is_personalized: true,
    }));

    return c.json({ success: true, data: formattedPersonalized });
  } catch (error: unknown) {
    console.error('Error fetching user sheets:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const generateBasicSheet = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { company, duration_days } = body;

  if (!company || !duration_days) {
    return c.json({ success: false, message: 'company and duration_days are required' }, 400);
  }

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('leetcode_username')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.leetcode_username) {
      return c.json(
        { success: false, message: 'Please set your LeetCode username in profile settings first.' },
        400
      );
    }

    const response = await fetch(`${AI_SERVICE_URL}/api/ingest/personalize/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        leetcode_username: user.leetcode_username,
        company,
        duration_days,
        mode: 'basic',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return c.json({ success: false, message: result.detail || 'AI service error' }, response.status as 400);
    }

    return c.json({ success: true, data: result.sheet, sheet: result.sheet });
  } catch (error: unknown) {
    console.error('Error generating basic sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const generateDeepSheet = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { company, duration_days } = body;

  if (!company || !duration_days) {
    return c.json({ success: false, message: 'company and duration_days are required' }, 400);
  }

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('leetcode_username, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.leetcode_username) {
      return c.json(
        { success: false, message: 'Please set your LeetCode username in profile settings first.' },
        400
      );
    }

    const { count: syncCount } = await supabase
      .from('leetcode_user_problems')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!syncCount || syncCount === 0) {
      return c.json(
        {
          success: false,
          message: 'Please sync your LeetCode solved problems via the extension before generating a deep plan.',
        },
        400
      );
    }

    const response = await fetch(`${AI_SERVICE_URL}/api/ingest/personalize/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_id: userId,
        leetcode_username: user.leetcode_username,
        company,
        duration_days,
        mode: 'deep',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return c.json({ success: false, message: result.detail || 'AI service error' }, response.status as 400);
    }

    return c.json({ success: true, data: result.sheet, sheet: result.sheet });
  } catch (error: unknown) {
    console.error('Error generating deep sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const setLeetcodeUsername = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { username } = body;
  if (!username) {
    return c.json({ success: false, message: 'username is required' }, 400);
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ leetcode_username: username, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    return c.json({ success: true, message: 'LeetCode username updated' });
  } catch (error: unknown) {
    console.error('Error setting LeetCode username:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const updateProfile = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { full_name, leetcode_username, cf_username } = body;
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (leetcode_username !== undefined) updates.leetcode_username = leetcode_username;
  if (cf_username !== undefined) updates.cf_username = cf_username;

  try {
    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) throw error;

    return c.json({ success: true, message: 'Profile updated' });
  } catch (error: unknown) {
    console.error('Error updating profile:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const syncLeetcodeData = async (c: Context) => {
  const userId = c.get('userId');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const problems = normalizeSyncPayload(body);
  if (problems.length === 0) {
    return c.json(
      { success: false, message: 'Provide problems: [{ slug, status? }] or solved_slugs: string[]' },
      400
    );
  }

  try {
    const uniqueSlugs = [...new Set(problems.map((p) => p.slug))];
    const slugToProblem = await fetchProblemsBySlugs(uniqueSlugs);
    const now = new Date().toISOString();

    const rows = problems.map((p) => {
      const meta = slugToProblem.get(p.slug);
      return {
        user_id: userId,
        problem_slug: p.slug,
        problem_id: meta?.id ?? null,
        difficulty: meta?.difficulty ?? null,
        topics: meta?.topic_tags ?? null,
        status: p.status || 'SOLVED',
        solved_at: p.solved_at ?? null,
        synced_at: now,
        last_attempted_at: p.last_attempted_at ?? null,
        failed_attempts_before_first_ac: p.failed_attempts_before_first_ac ?? 0,
        attempt_count: p.total_attempts ?? 0,
        failure_types: p.failure_types ?? null,
        has_resolved_after_gap: p.has_resolved_after_gap ?? false,
      };
    });

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('leetcode_user_problems').upsert(batch, {
        onConflict: 'user_id,problem_slug',
      });
      if (error) throw error;
    }

    const solvedSlugs = problems.filter((p) => p.status !== 'ATTEMPTED').map((p) => p.slug);

    await supabase
      .from('users')
      .update({
        solved_slugs: solvedSlugs,
        updated_at: now,
      })
      .eq('id', userId);

    try {
      await fetch(`${AI_SERVICE_URL}/api/ingest/profile/rebuild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch (e) {
      console.warn('Failed to trigger profile rebuild', e);
    }

    return c.json({
      success: true,
      message: `Successfully synced ${problems.length} problems from LeetCode (${solvedSlugs.length} solved).`,
      count: problems.length,
      solved_count: solvedSlugs.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error syncing LeetCode data:', error);
    return c.json({ success: false, message }, 500);
  }
};

export const syncLeetcodeRawChunk = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { submissions } = body;
  if (!submissions || !Array.isArray(submissions)) {
    return c.json({ success: false, message: 'submissions array required' }, 400);
  }

  try {
    const uniqueSlugs = [...new Set(submissions.map((s: any) => s.title_slug))];
    const slugToProblem = await fetchProblemsBySlugs(uniqueSlugs as string[]);

    const rows = submissions.map((s: any) => ({
      id: s.id,
      user_id: userId,
      problem_slug: s.title_slug,
      problem_id: slugToProblem.get(s.title_slug)?.id || null,
      status_code: s.status,
      status_display: s.status_display,
      language: s.lang,
      runtime_ms: s.runtime && s.runtime !== "N/A" ? parseInt(s.runtime) : null,
      memory_mb: s.memory && s.memory !== "N/A" ? parseFloat(s.memory) : null,
      submitted_at: new Date(s.timestamp * 1000).toISOString(),
    }));

    const { error } = await supabase.from('leetcode_submissions').upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    return c.json({ success: true, message: `Stored ${rows.length} submissions` });
  } catch (error: unknown) {
    console.error('Error syncing raw chunk:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const syncLeetcodeAggregate = async (c: Context) => {
  const userId = c.get('userId');
  let timeframe = null;
  try {
    const body = await c.req.json();
    timeframe = body.timeframe;
  } catch {
    // optional body
  }

  try {
    // 1. Fetch all raw submissions for this user
    const { data: subs, error: fetchErr } = await supabase
      .from('leetcode_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!subs || subs.length === 0) {
      return c.json({ success: true, message: 'No submissions found to aggregate.' });
    }

    // 2. Aggregate per slug
    const statsMap = new Map<string, any>();

    for (const sub of subs) {
      const slug = sub.problem_slug;
      if (!statsMap.has(slug)) {
        statsMap.set(slug, {
          user_id: userId,
          problem_slug: slug,
          problem_id: sub.problem_id,
          first_attempted_at: sub.submitted_at,
          last_attempted_at: sub.submitted_at,
          first_solved_at: null,
          last_solved_at: null,
          total_submissions: 0,
          accepted_count: 0,
          failed_before_first_ac: 0,
          wrong_answer_count: 0,
          tle_count: 0,
          mle_count: 0,
          runtime_error_count: 0,
          compile_error_count: 0,
          languages: new Set(),
          runtimes: [],
          first_ac_found: false,
          ac_timestamps: [],
        });
      }

      const st = statsMap.get(slug);
      st.total_submissions++;
      st.last_attempted_at = sub.submitted_at;
      st.languages.add(sub.language);

      if (sub.status_code === 10) {
        st.accepted_count++;
        st.ac_timestamps.push(new Date(sub.submitted_at).getTime());
        if (sub.runtime_ms) st.runtimes.push(sub.runtime_ms);

        if (!st.first_ac_found) {
          st.first_solved_at = sub.submitted_at;
          st.primary_language = sub.language;
          st.first_ac_found = true;
        }
        st.last_solved_at = sub.submitted_at;
      } else {
        if (!st.first_ac_found) {
          st.failed_before_first_ac++;
          if (sub.status_code === 11) st.wrong_answer_count++;
          else if (sub.status_code === 14) st.tle_count++;
          else if (sub.status_code === 12) st.mle_count++;
          else if (sub.status_code === 15) st.runtime_error_count++;
          else if (sub.status_code === 20) st.compile_error_count++;
        }
      }
    }

    const statsRows = [];
    const userProblemUpdates = [];
    const now = new Date().toISOString();

    for (const st of statsMap.values()) {
      st.final_status = st.first_ac_found ? 'SOLVED' : 'ATTEMPTED';
      st.solved_on_first_try = st.first_ac_found && st.failed_before_first_ac === 0;
      
      let was_revisited = false;
      let revisit_count = 0;
      let solved_after_gap = false;

      if (st.ac_timestamps.length >= 2) {
        was_revisited = true;
        revisit_count = st.ac_timestamps.length - 1;
        for (let i = 1; i < st.ac_timestamps.length; i++) {
          if ((st.ac_timestamps[i] - st.ac_timestamps[i-1]) > 30 * 24 * 60 * 60 * 1000) {
            solved_after_gap = true;
            break;
          }
        }
      }

      // Compute Mastery Score
      let base = st.first_ac_found ? 0.5 : 0.0;
      let attempt_penalty = Math.log(st.failed_before_first_ac + 1) * 0.12;
      let first_try_bonus = st.solved_on_first_try ? 0.20 : 0.0;
      
      let modifier = 1.0;
      const total_fails = st.failed_before_first_ac;
      if (total_fails > 0) {
        if (st.compile_error_count / total_fails > 0.5) modifier = 0.7;
        else if (st.tle_count / total_fails > 0.5) modifier = 0.85;
      }
      
      let revisit_bonus = was_revisited ? Math.min(0.10 * revisit_count, 0.20) : 0.0;
      let gap_solve_bonus = solved_after_gap ? 0.10 : 0.0;
      
      let raw_score = base + first_try_bonus + revisit_bonus + gap_solve_bonus - (attempt_penalty * modifier);
      let mastery_score = Math.max(0.0, Math.min(1.0, raw_score));

      // Recency decay
      if (st.last_solved_at) {
        const daysSinceLast = (new Date().getTime() - new Date(st.last_solved_at).getTime()) / (24 * 60 * 60 * 1000);
        let decay = 1.0;
        if (daysSinceLast > 365) decay = Math.max(0.35, 0.55 - 0.05 * ((daysSinceLast - 365) / 30));
        else if (daysSinceLast > 180) decay = 0.55;
        else if (daysSinceLast > 90) decay = 0.70;
        else if (daysSinceLast > 30) decay = 0.85;
        mastery_score *= decay;
      }

      const daysToSolve = st.first_solved_at 
        ? (new Date(st.first_solved_at).getTime() - new Date(st.first_attempted_at).getTime()) / (24 * 60 * 60 * 1000)
        : null;

      statsRows.push({
        user_id: st.user_id,
        problem_slug: st.problem_slug,
        problem_id: st.problem_id,
        final_status: st.final_status,
        first_attempted_at: st.first_attempted_at,
        first_solved_at: st.first_solved_at,
        last_attempted_at: st.last_attempted_at,
        last_solved_at: st.last_solved_at,
        days_to_first_solve: daysToSolve,
        total_submissions: st.total_submissions,
        accepted_count: st.accepted_count,
        failed_before_first_ac: st.failed_before_first_ac,
        solved_on_first_try: st.solved_on_first_try,
        wrong_answer_count: st.wrong_answer_count,
        tle_count: st.tle_count,
        mle_count: st.mle_count,
        runtime_error_count: st.runtime_error_count,
        compile_error_count: st.compile_error_count,
        was_revisited,
        revisit_count,
        solved_after_gap,
        best_runtime_ms: st.runtimes.length ? Math.min(...st.runtimes) : null,
        worst_runtime_ms: st.runtimes.length ? Math.max(...st.runtimes) : null,
        avg_runtime_ms: st.runtimes.length ? st.runtimes.reduce((a:any, b:any) => a + b, 0) / st.runtimes.length : null,
        languages_used: Array.from(st.languages),
        primary_language: st.primary_language,
        mastery_score,
        mastery_computed_at: now,
        computed_at: now
      });

      userProblemUpdates.push({
        user_id: st.user_id,
        problem_slug: st.problem_slug,
        first_solved_at: st.first_solved_at,
        last_solved_at: st.last_solved_at,
        failed_before_ac: st.failed_before_first_ac,
        mastery_score: mastery_score,
      });
    }

    // 3. Upsert to DB in chunks
    for (let i = 0; i < statsRows.length; i += 500) {
      await supabase.from('leetcode_problem_stats').upsert(statsRows.slice(i, i + 500), { onConflict: 'user_id,problem_slug' });
    }
    for (let i = 0; i < userProblemUpdates.length; i += 500) {
      await supabase.from('leetcode_user_problems').upsert(userProblemUpdates.slice(i, i + 500), { onConflict: 'user_id,problem_slug' });
    }

    // 4. Trigger profile rebuild
    try {
      await fetch(`${AI_SERVICE_URL}/api/ingest/profile/rebuild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch (e) {
      console.warn('Failed to trigger profile rebuild', e);
    }

    // 5. Update user sync level
    if (timeframe) {
      const { data: user } = await supabase.from('users').select('leetcode_sync_level').eq('id', userId).single();
      const levelMap: Record<string, number> = { '6_months': 1, '1_year': 2, 'all_time': 3 };
      const currentLevel = user?.leetcode_sync_level ? levelMap[user.leetcode_sync_level] || 0 : 0;
      const newLevel = levelMap[timeframe] || 0;
      
      const levelToSet = newLevel > currentLevel ? timeframe : user?.leetcode_sync_level;
      
      await supabase.from('users').update({
        leetcode_sync_level: levelToSet,
        leetcode_last_synced_at: now
      }).eq('id', userId);
    } else {
      await supabase.from('users').update({
        leetcode_last_synced_at: now
      }).eq('id', userId);
    }

    return c.json({ success: true, message: 'Aggregation complete and mastery updated.' });
  } catch (error: unknown) {
    console.error('Error in aggregate:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getLeetcodeSyncStatus = async (c: Context) => {
  const userId = c.get('userId');
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('leetcode_sync_level, leetcode_last_synced_at')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: maxData, error: maxErr } = await supabase
      .from('leetcode_submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1);
    
    if (maxErr) throw maxErr;

    const { data: minData, error: minErr } = await supabase
      .from('leetcode_submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: true })
      .limit(1);

    if (minErr) throw minErr;

    const latest = maxData && maxData.length > 0 ? new Date(maxData[0].submitted_at).getTime() / 1000 : null;
    const oldest = minData && minData.length > 0 ? new Date(minData[0].submitted_at).getTime() / 1000 : null;

    return c.json({
      success: true,
      sync_level: user?.leetcode_sync_level || null,
      last_synced_at: user?.leetcode_last_synced_at || null,
      latest_timestamp: latest,
      oldest_timestamp: oldest,
    });
  } catch (error: unknown) {
    console.error('Error fetching sync status:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getDashboardStats = async (c: Context) => {
  const userId = c.get('userId');

  try {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(today.getDate() - 181);

    // 1. Fetch Heatmap Data (from leetcode_submissions)
    const { data: submissions, error: subError } = await supabase
      .from('leetcode_submissions')
      .select('submitted_at, status_code')
      .eq('user_id', userId)
      .eq('status_code', 10)
      .gte('submitted_at', sixMonthsAgo.toISOString());

    if (subError) throw subError;

    // Aggregate submissions by date
    const dateCounts: Record<string, number> = {};
    for (const sub of (submissions || [])) {
      const dateStr = new Date(sub.submitted_at).toISOString().split('T')[0];
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    }

    // CF stats (only if user has cf_username)
    const { data: cfUser } = await supabase
      .from('users')
      .select('cf_username, cf_rating, cf_rank')
      .eq('id', userId)
      .single();

    if (cfUser?.cf_username) {
      const { data: cfSolved } = await supabase
        .from('cf_user_stats')
        .select('problem_id, final_verdict, last_solved_at')
        .eq('user_id', userId)
        .eq('final_verdict', 'SOLVED')
        .gte('last_solved_at', sixMonthsAgo.toISOString());

      // Merge CF solve dates into heatmap
      for (const sub of (cfSolved || [])) {
        if (sub.last_solved_at) {
          const dateStr = new Date(sub.last_solved_at).toISOString().split('T')[0];
          dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
        }
      }
    }

    const heatmap = [];
    for (let i = 181; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      heatmap.push({
        date: dateStr,
        value: dateCounts[dateStr] || 0,
      });
    }

    // 2. Fetch Topic Coverage Data (from leetcode_user_problems)
    const { data: problems, error: probError } = await supabase
      .from('leetcode_user_problems')
      .select('topics, status')
      .eq('user_id', userId)
      .eq('status', 'SOLVED');

    if (probError) throw probError;

    const topicCounts: Record<string, number> = {};
    for (const p of (problems || [])) {
      if (Array.isArray(p.topics)) {
        for (const topic of p.topics) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    }

    // Convert to array and take top 8
    const topicData = Object.entries(topicCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // If less than 8, fill with placeholders or just return what we have (frontend should handle it)

    // 3. Fetch Due for Review (from leetcode_user_problems)
    // Find ATTEMPTED problems or SOLVED problems with low mastery_score
    const { data: reviews, error: revError } = await supabase
      .from('leetcode_user_problems')
      .select('problem_slug, difficulty, status, mastery_score, last_solved_at')
      .eq('user_id', userId)
      .order('mastery_score', { ascending: true })
      .limit(5);

    if (revError) throw revError;

    const upcomingReviews = (reviews || []).map((r: any) => {
      // Calculate a rough "due in" based on last_solved_at
      let dueStr = "Due soon";
      if (r.last_solved_at) {
        const daysSince = Math.floor((new Date().getTime() - new Date(r.last_solved_at).getTime()) / (1000 * 3600 * 24));
        const dueDays = Math.max(0, 7 - daysSince);
        dueStr = dueDays === 0 ? "Due today" : `Due in ${dueDays} day${dueDays > 1 ? 's' : ''}`;
      }

      return {
        title: r.problem_slug.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        slug: r.problem_slug,
        difficulty: (r.difficulty || 'medium').toLowerCase(),
        due: dueStr,
        isWarning: r.status === 'ATTEMPTED' || r.mastery_score < 0.4,
      };
    });

    return c.json({
      success: true,
      data: {
        heatmap,
        topicData,
        upcomingReviews,
        cfUser,
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching dashboard stats:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
