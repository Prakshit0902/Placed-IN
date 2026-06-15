import { Hono } from 'hono';
import { generateCpSheet, getMyCpSheets, getCpSheet, updateCpProgress } from '../controllers/cp_sheets.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const cpSheetsRouter = new Hono();

cpSheetsRouter.use('*', authMiddleware);
cpSheetsRouter.post('/generate', generateCpSheet);
cpSheetsRouter.get('/', getMyCpSheets);
cpSheetsRouter.get('/:id', getCpSheet);
cpSheetsRouter.patch('/:id/progress/:problemId', updateCpProgress);

export default cpSheetsRouter;
