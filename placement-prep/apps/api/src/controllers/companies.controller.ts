import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';

export const getCompanies = async (c: Context) => {
  try {
    // We use an RPC call or direct group by. 
    // Supabase JS doesn't have direct aggregate functions for group by count easily in JS client,
    // but we can query a view or fetch distinct. 
    // Since we generated templates, we can just fetch companies that have templates.
    const { data: templates, error } = await supabase
      .from('prep_templates')
      .select('company, generated_from_question_count')
      .order('generated_from_question_count', { ascending: false });

    if (error) throw error;

    // Deduplicate companies from templates
    const uniqueCompanies = Array.from(
      new Map(templates?.map((item) => [item.company, item])).values()
    );

    return c.json({ success: true, data: uniqueCompanies });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getCompanyProblems = async (c: Context) => {
  const company = c.req.param('name');
  if (!company) {
    return c.json({ success: false, message: 'Company name parameter is required' }, 400);
  }
  const page = c.req.query('page') || '1';
  const PAGE_SIZE = 50;

  const offset = (Number(page) - 1) * PAGE_SIZE;
  const limit = offset + PAGE_SIZE - 1;

  try {
    // Join lc_problems and lc_company_questions
    const { data, error, count } = await supabase
      .from('lc_company_questions')
      .select(`
        frequency,
        lc_problems (
          id, title, slug, difficulty, topic_tags, ac_rate
        )
      `, { count: 'exact' })
      .ilike('company', company)
      .order('frequency', { ascending: false })
      .range(offset, limit);

    if (error) throw error;

    return c.json({ 
      success: true, 
      data: data,
      pagination: {
        page: Number(page),
        total: count,
        totalPages: count ? Math.ceil(count / PAGE_SIZE) : 0
      }
    });
  } catch (error: any) {
    console.error(`Error fetching problems for company ${company}:`, error);
    return c.json({ success: false, message: error.message }, 500);
  }
};
