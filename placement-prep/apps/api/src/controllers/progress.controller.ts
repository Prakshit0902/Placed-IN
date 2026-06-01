import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

export const getSheetProgress = async (c: Context) => {
  const userId = c.get('userId');
  const sheetId = c.req.param('sheetId');

  try {
    const { data, error } = await supabase
      .from('sheet_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('sheet_id', sheetId)
      .order('week_number', { ascending: true });

    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching sheet progress:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getTemplateProgress = async (c: Context) => {
  const userId = c.get('userId');
  const templateId = c.req.param('templateId');

  try {
    const { data, error } = await supabase
      .from('sheet_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('template_id', templateId)
      .order('week_number', { ascending: true });

    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching template progress:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getStreak = async (c: Context) => {
  const userId = c.get('userId');

  try {
    // Get all distinct dates with at least one completion, ordered descending
    const { data, error } = await supabase
      .from('sheet_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return c.json({ success: true, data: { current_streak: 0, total_completed: 0 } });
    }

    // Extract unique dates (YYYY-MM-DD)
    const uniqueDates = [...new Set(
      data.map((row: any) => new Date(row.completed_at).toISOString().split('T')[0])
    )].sort().reverse();

    // Count consecutive streak from today or yesterday
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedDate = expected.toISOString().split('T')[0];

      if (uniqueDates[i] === expectedDate) {
        streak++;
      } else if (i === 0 && uniqueDates[i] === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
        // Allow streak to start from yesterday if nothing done today yet
        streak++;
      } else {
        break;
      }
    }

    return c.json({
      success: true,
      data: {
        current_streak: streak,
        total_completed: data.length,
        last_completed: uniqueDates[0] || null
      }
    });
  } catch (error: any) {
    console.error('Error calculating streak:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const updateProgress = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }
  
  const { sheet_id, template_id, week_number, question_id, status, time_spent_minutes, notes } = body;

  if (!question_id || (!sheet_id && !template_id)) {
    return c.json({ success: false, message: 'question_id and either sheet_id or template_id are required' }, 400);
  }

  try {
    // Check if progress entry already exists
    let query = supabase
      .from('sheet_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', question_id);

    if (sheet_id) query = query.eq('sheet_id', sheet_id);
    if (template_id) query = query.eq('template_id', template_id);

    const { data: existing } = await query.maybeSingle();
    
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    
    if (existing) {
      const { error } = await supabase.from('sheet_progress').update({
        status,
        time_spent_minutes,
        notes,
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
      
      if (error) throw error;
    } else {
      const { error } = await supabase.from('sheet_progress').insert({
        user_id: userId,
        sheet_id: sheet_id || null,
        template_id: template_id || null,
        week_number: week_number || 1,
        question_id,
        status: status || 'not_started',
        time_spent_minutes: time_spent_minutes || 0,
        notes,
        completed_at: completedAt,
      });
      
      if (error) throw error;
    }

    return c.json({ success: true, message: 'Progress updated' });
  } catch (error: any) {
    console.error('Error updating progress:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
