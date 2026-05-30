import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

export const getMySheets = async (c: Context) => {
  const userId = c.get('userId');
  try {
    // 1. Fetch personalized sheets
    const { data: personalizedSheets, error: pError } = await supabase
      .from('personalized_sheets')
      .select('id, company, role, duration_days, completion_status, created_at, updated_at')
      .eq('user_id', userId);

    if (pError) throw pError;

    // 2. Fetch templates that user has progress for
    const { data: progressEntries, error: prError } = await supabase
      .from('sheet_progress')
      .select('template_id')
      .eq('user_id', userId)
      .not('template_id', 'is', null);

    if (prError) throw prError;

    const templateIds = Array.from(new Set(progressEntries?.map((p: any) => p.template_id) || []));
    
    let standardSheets: any[] = [];
    if (templateIds.length > 0) {
      const { data: templates, error: tError } = await supabase
        .from('prep_templates')
        .select('id, company, role, duration_days, created_at, updated_at')
        .in('id', templateIds);
        
      if (tError) throw tError;
      standardSheets = templates || [];
    }

    // 3. Format and merge
    const formattedPersonalized = (personalizedSheets || []).map((s: any) => ({
      ...s,
      is_personalized: true
    }));

    const formattedStandard = standardSheets.map((s: any) => ({
      ...s,
      completion_status: 'in_progress',
      is_personalized: false
    }));

    const allSheets = [...formattedPersonalized, ...formattedStandard].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return c.json({ success: true, data: allSheets });
  } catch (error: any) {
    console.error('Error fetching sheets:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const generatePersonalizedSheet = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { company, duration_days } = body;
  if (!company || !duration_days) {
    return c.json({ success: false, message: 'company and duration_days are required' }, 400);
  }

  try {
    // 1. Fetch user to get leetcode_username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('leetcode_username, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return c.json({ success: false, message: 'User not found' }, 404);
    }
    
    if (!user.leetcode_username) {
      return c.json({ success: false, message: 'LeetCode username is required for personalized sheets. Update it in settings.' }, 400);
    }

    // 2. Call AI Service to generate personalized sheet
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${AI_SERVICE_URL}/api/ingest/personalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        leetcode_username: user.leetcode_username,
        company,
        duration_days
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return c.json({ success: false, message: errorData.detail || 'AI Service Error' }, response.status as any);
    }

    const result = await response.json();
    return c.json({ success: true, data: result.sheet });
  } catch (error: any) {
    console.error('Error generating personalized sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const setLeetcodeUsername = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }
  
  const { username } = body;
    
  if (!username) {
    return c.json({ success: false, message: 'Username is required' }, 400);
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ leetcode_username: username, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
    
    return c.json({ success: true, message: 'LeetCode username updated' });
  } catch (error: any) {
    console.error('Error updating leetcode username:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const updateProfile = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }
  
  const { full_name, leetcode_username } = body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  
  if (full_name !== undefined) updates.full_name = full_name;
  if (leetcode_username !== undefined) updates.leetcode_username = leetcode_username;

  try {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
    
    return c.json({ success: true, message: 'Profile updated' });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
