import { Hono } from 'hono';
import { createOrder, verifyPayment, getSubscriptionStatus } from '../controllers/billing.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export const billingRouter = new Hono();

billingRouter.use('*', authMiddleware);

billingRouter.post('/create-order', createOrder);
billingRouter.post('/verify', verifyPayment);
billingRouter.get('/subscription', getSubscriptionStatus);
