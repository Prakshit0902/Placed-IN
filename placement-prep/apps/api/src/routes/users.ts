import { Hono } from 'hono';
import { getMySheets, generatePersonalizedSheet, setLeetcodeUsername, updateProfile } from '../controllers/users.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';

export const usersRouter = new Hono();

// All user routes require authentication
usersRouter.use('*', authMiddleware);

usersRouter.get('/sheets', getMySheets);
usersRouter.patch('/profile', updateProfile);
usersRouter.post('/leetcode-username', setLeetcodeUsername);

// Requires premium or enterprise for personalized generation
usersRouter.post('/sheets/generate', requireSubscription(['premium', 'enterprise']), generatePersonalizedSheet);
