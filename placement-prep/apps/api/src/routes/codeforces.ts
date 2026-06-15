import { Hono } from 'hono';
import { syncCfData, aggregateCfData, getCfSyncStatus } from '../controllers/codeforces.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const codeforcesRouter = new Hono();

codeforcesRouter.use('*', authMiddleware);
codeforcesRouter.post('/sync', syncCfData);
codeforcesRouter.post('/aggregate', aggregateCfData);
codeforcesRouter.get('/sync-status', getCfSyncStatus);

export default codeforcesRouter;
