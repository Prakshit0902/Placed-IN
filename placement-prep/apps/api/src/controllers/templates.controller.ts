import { Context } from 'hono'
import { supabase } from '../lib/supabase.js'

const toTemplateResponse = (template: any) => ({
  ...template,
  template_id: template.id,
})

export const getTemplates = async (c: Context) => {
  try {
    const { data: templates, error } = await supabase
      .from('prep_templates')
      .select('id, company, role, duration_days, total_weeks, total_questions, updated_at')
      .order('updated_at', { ascending: false })

    if (error) throw error

    return c.json({ success: true, data: templates?.map(toTemplateResponse) ?? [] })
  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return c.json({ success: false, message: error.message }, 500)
  }
}

export const getTemplateById = async (c: Context) => {
  const id = c.req.param('id')
  
  try {
    const { data: template, error } = await supabase
      .from('prep_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!template) return c.json({ success: false, message: 'Template not found' }, 404)

    return c.json({ success: true, data: toTemplateResponse(template) })
  } catch (error: any) {
    console.error('Error fetching template details:', error)
    return c.json({ success: false, message: error.message }, 500)
  }
}

// Additional CRUD if needed from API (mostly, Python script inserts, but we can add an upsert endpoint if the API needs it later)
