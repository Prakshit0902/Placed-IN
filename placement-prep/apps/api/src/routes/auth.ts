import { Hono } from 'hono';
import { clerkWebhook, getMe } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = new Hono();

// Public webhook route (verified by Svix signature inside controller)
authRouter.post('/webhook', clerkWebhook);

// Protected route
authRouter.get('/me', authMiddleware, getMe);
