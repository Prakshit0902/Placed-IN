import { Hono } from 'hono';
import { getSheetProgress, getTemplateProgress, getStreak, updateProgress } from '../controllers/progress.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const progressRouter = new Hono();

progressRouter.use('*', authMiddleware);

progressRouter.post('/update', updateProgress);
progressRouter.get('/streak', getStreak);
progressRouter.get('/sheet/:sheetId', getSheetProgress);
progressRouter.get('/template/:templateId', getTemplateProgress);
