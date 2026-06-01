import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

type LcProblemRow = {
  id: number;
  title: string;
  slug: string;
  difficulty: string | null;
  topic_tags: string[] | null;
};

async function fetchProblemsByIds(ids: number[]): Promise<Map<number, LcProblemRow>> {
  const map = new Map<number, LcProblemRow>();
  if (ids.length === 0) return map;

  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('lc_problems')
      .select('id, title, slug, difficulty, topic_tags')
      .in('id', chunk);
    if (error) throw error;
    for (const row of data || []) {
      map.set(row.id, row);
    }
  }
  return map;
}

async function hydratePersonalizedSheet(sheet: Record<string, unknown>) {
  const weekQuestionIds = sheet.week_question_ids as
    | { week?: number; week_number?: number; theme?: string; question_ids?: number[] }[]
    | null;

  if (!weekQuestionIds?.length) {
    return sheet;
  }

  const allIds = weekQuestionIds.flatMap((w) => w.question_ids || []);
  const problemMap = await fetchProblemsByIds(allIds);
  const personalizedWeeks = (sheet.personalized_data as { weeks?: unknown[] })?.weeks || [];

  const weeks = weekQuestionIds.map((w, idx) => {
    const weekNum = w.week ?? w.week_number ?? idx + 1;
    const llmWeek = (personalizedWeeks as { week?: number; week_number?: number; theme?: string; metrics?: unknown; estimated_hours?: number }[]).find(
      (pw) => (pw.week ?? pw.week_number) === weekNum
    );
    const questions = (w.question_ids || [])
      .map((id) => {
        const p = problemMap.get(id);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          difficulty: p.difficulty || 'Medium',
          topic_tags: p.topic_tags || [],
        };
      })
      .filter(Boolean);

    return {
      week: weekNum,
      week_number: weekNum,
      theme: w.theme || llmWeek?.theme || `Week ${weekNum}`,
      questions,
      metrics: llmWeek?.metrics,
      estimated_hours: llmWeek?.estimated_hours,
    };
  });

  const totalQuestions = weeks.reduce((sum, w) => sum + (w.questions?.length || 0), 0);

  return {
    ...sheet,
    total_weeks: weeks.length,
    total_questions: totalQuestions,
    personalized_data: {
      ...(typeof sheet.personalized_data === 'object' && sheet.personalized_data !== null
        ? sheet.personalized_data
        : {}),
      weeks,
    },
  };
}

export const getGenericSheets = async (c: Context) => {
  try {
    const { data, error } = await supabase
      .from('prep_templates')
      .select('id, company, role, duration_days, total_weeks, total_questions, generated_from_question_count')
      .order('company');

    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching generic sheets:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getSheetPreview = async (c: Context) => {
  const id = c.req.param('id');
  try {
    const { data, error } = await supabase
      .from('prep_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return c.json({ success: false, message: 'Template not found' }, 404);
      throw error;
    }
    
    // For preview, only show first 2 weeks
    const previewData = { ...data };
    if (previewData.template_data?.weeks) {
      previewData.template_data = {
        ...previewData.template_data,
        weeks: previewData.template_data.weeks.slice(0, 2)
      };
      previewData.isPreview = true;
    }

    return c.json({ success: true, data: previewData });
  } catch (error: any) {
    console.error('Error fetching sheet preview:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getFullTemplate = async (c: Context) => {
  const id = c.req.param('id');
  try {
    const { data, error } = await supabase
      .from('prep_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return c.json({ success: false, message: 'Template not found' }, 404);
      throw error;
    }

    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching full template:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

export const getPersonalizedSheet = async (c: Context) => {
  const userId = c.get('userId');
  const sheetId = c.req.param('sheetId');

  try {
    const { data, error } = await supabase
      .from('personalized_sheets')
      .select('*')
      .eq('id', sheetId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return c.json({ success: false, message: 'Sheet not found' }, 404);
      throw error;
    }

    const hydrated = await hydratePersonalizedSheet(data as Record<string, unknown>);
    return c.json({ success: true, data: hydrated });
  } catch (error: any) {
    console.error('Error fetching personalized sheet:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};
