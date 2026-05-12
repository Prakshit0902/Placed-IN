import { Hono } from 'hono'
import { getTemplates, getTemplateById } from '../controllers/templates.controller.js'

export const templatesRouter = new Hono()

// GET /api/templates
templatesRouter.get('/', getTemplates)

// GET /api/templates/:id
templatesRouter.get('/:id', getTemplateById)
