import { Hono } from 'hono';
import { getGenericSheets, getSheetPreview, getFullTemplate, getPersonalizedSheet } from '../controllers/sheets.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const sheetsRouter = new Hono();

// Public routes
sheetsRouter.get('/', getGenericSheets);
sheetsRouter.get('/:id/preview', getSheetPreview);

// Auth-required routes
sheetsRouter.get('/:id/full', authMiddleware, getFullTemplate);
sheetsRouter.get('/personalized/:sheetId', authMiddleware, getPersonalizedSheet);
