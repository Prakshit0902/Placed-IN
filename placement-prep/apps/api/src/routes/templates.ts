import { Hono } from 'hono'
import { getTemplates, getTemplateById } from '../controllers/templates.controller.js'

export const templatesRouter = new Hono()

// GET /api/templates
templatesRouter.get('/', getTemplates)

// GET /api/templates/generate?company=X&role=Y&duration=Z
// templatesRouter.get('/generate', generateSheet)

// GET /api/templates/:id
templatesRouter.get('/:id', getTemplateById)
