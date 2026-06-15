import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const VERDICT_MAP: Record<string, string> = {
  'OK': 'SOLVED',
  'WRONG_ANSWER': 'ATTEMPTED',
  'TIME_LIMIT_EXCEEDED': 'ATTEMPTED',
  'MEMORY_LIMIT_EXCEEDED': 'ATTEMPTED',
  'RUNTIME_ERROR': 'ATTEMPTED',
  'COMPILATION_ERROR': 'ATTEMPTED',
};

export const syncCfData = async (c: Context) => {
  const userId = c.get('userId');

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('cf_username')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.cf_username) {
      return c.json({ success: false, message: 'Codeforces username not set.' }, 400);
    }

    const handle = user.cf_username;

    // Fetch user info
    const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
    if (!infoRes.ok) {
      return c.json({ success: false, message: 'Failed to fetch CF user info.' }, 400);
    }
    const infoData = await infoRes.json();
    if (infoData.status !== 'OK' || !infoData.result || infoData.result.length === 0) {
      return c.json({ success: false, message: 'CF handle not found.' }, 400);
    }
    const cfUser = infoData.result[0];

    // Update rating/rank in DB
    await supabase.from('users').update({
      cf_rating: cfUser.rating || null,
      cf_rank: cfUser.rank || null,
    }).eq('id', userId);

    // Fetch user submissions
    // For large accounts, pagination is needed but CF API allows fetching all if count is large.
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20000`);
    if (!statusRes.ok) {
      return c.json({ success: false, message: 'Failed to fetch CF submissions.' }, 400);
    }
    const statusData = await statusRes.json();
    if (statusData.status !== 'OK') {
      return c.json({ success: false, message: 'Error fetching CF submissions.' }, 400);
    }

    const submissions = statusData.result;
    
    if (submissions.length > 0) {
      const rows = submissions.map((s: any) => {
        const problemId = `${s.problem.contestId}${s.problem.index}`;
        return {
          id: s.id,
          user_id: userId,
          cf_handle: handle,
          problem_id: problemId,
          problem_name: s.problem.name,
          contest_id: s.problem.contestId,
          verdict: s.verdict,
          language: s.programmingLanguage,
          time_consumed_ms: s.timeConsumedMillis,
          memory_consumed_kb: s.memoryConsumedBytes ? Math.round(s.memoryConsumedBytes / 1024) : 0,
          submitted_at: new Date(s.creationTimeSeconds * 1000).toISOString(),
          synced_at: new Date().toISOString()
        };
      });

      // Upsert submissions in chunks
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('cf_user_submissions').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
      }
    }

    // Call aggregate after syncing
    await aggregateCfDataInternal(userId);
    
    // Update last_synced_at
    await supabase.from('users').update({
      cf_last_synced_at: new Date().toISOString()
    }).eq('id', userId);

    // Trigger AI profile rebuild
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
      console.warn('Failed to trigger AI profile rebuild', e);
    }

    return c.json({ success: true, message: `Successfully synced ${submissions.length} CF submissions.` });

  } catch (error: unknown) {
    console.error('Error syncing CF data:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};


export const aggregateCfData = async (c: Context) => {
  const userId = c.get('userId');
  try {
    await aggregateCfDataInternal(userId);
    return c.json({ success: true, message: 'CF data aggregated successfully.' });
  } catch (error: unknown) {
    console.error('Error aggregating CF data:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

async function aggregateCfDataInternal(userId: string) {
  const { data: subs, error: fetchErr } = await supabase
    .from('cf_user_submissions')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: true });

  if (fetchErr) throw fetchErr;
  if (!subs || subs.length === 0) return;

  const statsMap = new Map<string, any>();

  for (const sub of subs) {
    const pId = sub.problem_id;
    if (!statsMap.has(pId)) {
      statsMap.set(pId, {
        user_id: userId,
        problem_id: pId,
        first_attempted_at: sub.submitted_at,
        last_attempted_at: sub.submitted_at,
        first_solved_at: null,
        last_solved_at: null,
        total_submissions: 0,
        accepted_count: 0,
        wrong_answer_count: 0,
        tle_count: 0,
        mle_count: 0,
        runtime_error_count: 0,
        compile_error_count: 0,
        failed_before_first_ac: 0,
        languages: new Set(),
        runtimes: [],
        first_ac_found: false,
      });
    }

    const st = statsMap.get(pId);
    st.total_submissions++;
    st.last_attempted_at = sub.submitted_at;
    st.languages.add(sub.language);

    if (sub.verdict === 'OK') {
      st.accepted_count++;
      if (sub.time_consumed_ms !== null) st.runtimes.push(sub.time_consumed_ms);

      if (!st.first_ac_found) {
        st.first_solved_at = sub.submitted_at;
        st.primary_language = sub.language;
        st.first_ac_found = true;
      }
      st.last_solved_at = sub.submitted_at;
    } else {
      if (!st.first_ac_found) {
        st.failed_before_first_ac++;
        if (sub.verdict === 'WRONG_ANSWER') st.wrong_answer_count++;
        else if (sub.verdict === 'TIME_LIMIT_EXCEEDED') st.tle_count++;
        else if (sub.verdict === 'MEMORY_LIMIT_EXCEEDED') st.mle_count++;
        else if (sub.verdict === 'RUNTIME_ERROR') st.runtime_error_count++;
        else if (sub.verdict === 'COMPILATION_ERROR') st.compile_error_count++;
      }
    }
  }

  const statsRows = [];
  const now = new Date().toISOString();

  for (const st of statsMap.values()) {
    st.final_verdict = st.first_ac_found ? 'SOLVED' : 'ATTEMPTED';
    
    // Mastery algorithm mirroring LeetCode
    let base = st.first_ac_found ? 0.5 : 0.0;
    let attempt_penalty = Math.log(st.failed_before_first_ac + 1) * 0.12;
    let first_try_bonus = (st.first_ac_found && st.failed_before_first_ac === 0) ? 0.20 : 0.0;
    
    let modifier = 1.0;
    if (st.failed_before_first_ac > 0) {
      if (st.compile_error_count / st.failed_before_first_ac > 0.5) modifier = 0.7;
      else if (st.tle_count / st.failed_before_first_ac > 0.5) modifier = 0.85;
    }
    
    let raw_score = base + first_try_bonus - (attempt_penalty * modifier);
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

    statsRows.push({
      user_id: st.user_id,
      problem_id: st.problem_id,
      final_verdict: st.final_verdict,
      first_attempted_at: st.first_attempted_at,
      first_solved_at: st.first_solved_at,
      last_solved_at: st.last_solved_at,
      total_submissions: st.total_submissions,
      accepted_count: st.accepted_count,
      wrong_answer_count: st.wrong_answer_count,
      tle_count: st.tle_count,
      mle_count: st.mle_count,
      runtime_error_count: st.runtime_error_count,
      compile_error_count: st.compile_error_count,
      failed_before_first_ac: st.failed_before_first_ac,
      best_time_ms: st.runtimes.length ? Math.min(...st.runtimes) : null,
      languages_used: Array.from(st.languages),
      primary_language: st.primary_language || null,
      mastery_score,
      mastery_computed_at: now,
      computed_at: now,
    });
  }

  for (let i = 0; i < statsRows.length; i += 500) {
    await supabase.from('cf_user_stats').upsert(statsRows.slice(i, i + 500), { onConflict: 'user_id,problem_id' });
  }
}

export const getCfSyncStatus = async (c: Context) => {
  const userId = c.get('userId');
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('cf_username, cf_rating, cf_rank, cf_last_synced_at')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: subsData, error: subsError } = await supabase
      .from('cf_user_submissions')
      .select('submitted_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1);

    const latest = subsData && subsData.length > 0 ? new Date(subsData[0].submitted_at).getTime() / 1000 : null;

    return c.json({
      success: true,
      cf_username: user?.cf_username || null,
      cf_rating: user?.cf_rating || null,
      cf_rank: user?.cf_rank || null,
      last_synced_at: user?.cf_last_synced_at || null,
      latest_timestamp: latest,
    });
  } catch (error: unknown) {
    console.error('Error fetching CF sync status:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
