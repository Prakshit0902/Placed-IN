import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

export const generateCpSheet = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { sheet_name, sheet_type, target_level, selected_topics, platforms, duration_days, lc_difficulties, cf_rating_min, cf_rating_max } = body;

  if (!sheet_name || !duration_days || !platforms || platforms.length === 0) {
    return c.json({ success: false, message: 'Missing required parameters' }, 400);
  }

  try {
    // 1. Fetch user's solved CF and LC problems
    const { data: lcSolved } = await supabase
      .from('leetcode_user_problems')
      .select('problem_id')
      .eq('user_id', userId)
      .eq('status', 'SOLVED');
    const lcSolvedSet = new Set((lcSolved || []).map((s: any) => s.problem_id).filter(Boolean));

    const { data: cfSolved } = await supabase
      .from('cf_user_stats')
      .select('problem_id')
      .eq('user_id', userId)
      .eq('final_verdict', 'SOLVED');
    const cfSolvedSet = new Set((cfSolved || []).map((s: any) => s.problem_id).filter(Boolean));

    // 2. Fetch problems matching criteria
    let availableLc: any[] = [];
    if (platforms.includes('leetcode') && lc_difficulties?.length > 0) {
      let query = supabase.from('lc_problems').select('id, slug, title, difficulty, topic_tags').in('difficulty', lc_difficulties.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()));
      if (selected_topics?.length > 0) {
         query = query.overlaps('topic_tags', selected_topics);
      }
      const { data } = await query.limit(5000);
      availableLc = (data || []).filter((p: any) => !lcSolvedSet.has(p.id));
    }

    let availableCf: any[] = [];
    if (platforms.includes('codeforces')) {
      let query = supabase.from('cf_problems')
        .select('id, name, rating, tags, cf_url')
        .gte('rating', cf_rating_min || 800)
        .lte('rating', cf_rating_max || 3500);
      
      // We map LC topics to CF tags or just use as is for now if the user selects them
      if (selected_topics?.length > 0) {
         const cfTags = selected_topics.map((t: string) => t.toLowerCase());
         query = query.overlaps('tags', cfTags);
      }
      const { data } = await query.limit(5000);
      availableCf = (data || []).filter((p: any) => !cfSolvedSet.has(p.id));
    }

    // 3. Shuffle arrays for random selection
    const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);
    shuffle(availableLc);
    shuffle(availableCf);

    // 4. Distribute across days based on target_level
    let probsPerDay = 4;
    if (target_level === 'beginner') probsPerDay = 3;
    if (target_level === 'expert') probsPerDay = 5;
    if (target_level === 'cp') probsPerDay = 6;

    const totalProblemsNeeded = probsPerDay * duration_days;
    const sheet_data = [];

    let lcIdx = 0;
    let cfIdx = 0;

    for (let day = 1; day <= duration_days; day++) {
      const dailyTasks = [];
      for (let i = 0; i < probsPerDay; i++) {
        // Alternate platforms based on availability and what was selected
        const useLc = platforms.includes('leetcode') && (i % 2 === 0 || !platforms.includes('codeforces')) && lcIdx < availableLc.length;
        const useCf = platforms.includes('codeforces') && (!useLc || cfIdx < availableCf.length);

        if (useLc) {
           dailyTasks.push({
             platform: 'leetcode',
             problem_id: availableLc[lcIdx].id,
             problem_slug: availableLc[lcIdx].slug,
             problem_name: availableLc[lcIdx].title,
             difficulty: availableLc[lcIdx].difficulty,
           });
           lcIdx++;
        } else if (useCf) {
           dailyTasks.push({
             platform: 'codeforces',
             problem_id: availableCf[cfIdx].id,
             problem_name: availableCf[cfIdx].name,
             rating: availableCf[cfIdx].rating,
             cf_url: availableCf[cfIdx].cf_url,
           });
           cfIdx++;
        } else {
           // Not enough problems to satisfy the requirement
           break;
        }
      }
      sheet_data.push({
        day_number: day,
        problems: dailyTasks
      });
    }

    // 5. Save to cp_sheets
    const { data: newSheet, error: insertError } = await supabase
      .from('cp_sheets')
      .insert({
        user_id: userId,
        sheet_name,
        sheet_type,
        target_level,
        selected_topics: selected_topics || [],
        platforms,
        duration_days,
        lc_difficulties: lc_difficulties || [],
        cf_rating_min: cf_rating_min || 800,
        cf_rating_max: cf_rating_max || 1800,
        sheet_data,
        completion_status: 'in_progress',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 6. Pre-fill cp_sheet_progress
    const progressRows = [];
    for (const day of sheet_data) {
      for (const p of day.problems) {
        progressRows.push({
          user_id: userId,
          sheet_id: newSheet.id,
          platform: p.platform,
          lc_problem_id: p.platform === 'leetcode' ? p.problem_id : null,
          cf_problem_id: p.platform === 'codeforces' ? p.problem_id : null,
          problem_name: p.problem_name,
          day_number: day.day_number,
          status: 'not_started',
        });
      }
    }

    // Batch insert progress
    for (let i = 0; i < progressRows.length; i += 500) {
      await supabase.from('cp_sheet_progress').insert(progressRows.slice(i, i + 500));
    }

    return c.json({ success: true, data: newSheet });
  } catch (error: unknown) {
    console.error('Error generating CP sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getMyCpSheets = async (c: Context) => {
  const userId = c.get('userId');
  try {
    const { data: sheets, error } = await supabase
      .from('cp_sheets')
      .select('id, sheet_name, sheet_type, target_level, duration_days, completion_status, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ success: true, data: sheets });
  } catch (error: unknown) {
    console.error('Error fetching CP sheets:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getCpSheet = async (c: Context) => {
  const userId = c.get('userId');
  const sheetId = c.req.param('id');
  
  try {
    const { data: sheet, error: sheetError } = await supabase
      .from('cp_sheets')
      .select('*')
      .eq('id', sheetId)
      .eq('user_id', userId)
      .single();

    if (sheetError) throw sheetError;

    const { data: progress, error: progError } = await supabase
      .from('cp_sheet_progress')
      .select('*')
      .eq('sheet_id', sheetId)
      .eq('user_id', userId);

    if (progError) throw progError;

    // Merge progress into sheet_data
    const progressMap = new Map();
    for (const p of progress) {
      const key = p.platform === 'leetcode' ? `lc_${p.lc_problem_id}` : `cf_${p.cf_problem_id}`;
      progressMap.set(key, p);
    }

    const mergedData = sheet.sheet_data.map((day: any) => ({
      ...day,
      problems: day.problems.map((p: any) => {
        const key = p.platform === 'leetcode' ? `lc_${p.problem_id}` : `cf_${p.problem_id}`;
        const prog = progressMap.get(key);
        return {
          ...p,
          status: prog?.status || 'not_started',
          notes: prog?.notes || '',
        };
      })
    }));

    sheet.sheet_data = mergedData;
    return c.json({ success: true, data: sheet });
  } catch (error: unknown) {
    console.error('Error fetching CP sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const updateCpProgress = async (c: Context) => {
  const userId = c.get('userId');
  const sheetId = c.req.param('id');
  const problemId = c.req.param('problemId'); // e.g. "lc_123" or "cf_1234A"
  
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { status, notes } = body;
  const platform = problemId.startsWith('lc_') ? 'leetcode' : 'codeforces';
  const realProblemId = problemId.replace('lc_', '').replace('cf_', '');

  try {
    let query = supabase
      .from('cp_sheet_progress')
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq('sheet_id', sheetId)
      .eq('user_id', userId)
      .eq('platform', platform);
      
    if (platform === 'leetcode') {
      query = query.eq('lc_problem_id', parseInt(realProblemId));
    } else {
      query = query.eq('cf_problem_id', realProblemId);
    }

    const { error } = await query;
    if (error) throw error;

    return c.json({ success: true, message: 'Progress updated' });
  } catch (error: unknown) {
    console.error('Error updating CP progress:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
