import { Hono } from 'hono';
import { getMySheets, generateBasicSheet, generateDeepSheet, setLeetcodeUsername, updateProfile, syncLeetcodeData, syncLeetcodeRawChunk, syncLeetcodeAggregate, getLeetcodeSyncStatus } from '../controllers/users.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';

export const usersRouter = new Hono();

// All user routes require authentication
usersRouter.use('*', authMiddleware);

usersRouter.get('/sheets', getMySheets);
usersRouter.patch('/profile', updateProfile);
usersRouter.post('/leetcode-username', setLeetcodeUsername);
usersRouter.post('/leetcode/sync', syncLeetcodeData);
usersRouter.post('/leetcode/sync-raw', syncLeetcodeRawChunk);
usersRouter.post('/leetcode/sync-aggregate', syncLeetcodeAggregate);
usersRouter.get('/leetcode/sync-status', getLeetcodeSyncStatus);

// Free/Basic personalization
usersRouter.post('/sheets/generate', generateBasicSheet);

// Deep personalization requires premium or enterprise
usersRouter.post('/sheets/generate/deep', requireSubscription(['premium', 'enterprise']), generateDeepSheet);
