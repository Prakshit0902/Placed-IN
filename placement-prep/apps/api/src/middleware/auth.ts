import { createMiddleware } from 'hono/factory';
import { createClerkClient } from '@clerk/backend';

const clerkClient = process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY 
  ? createClerkClient({ 
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY
    })
  : null;

export type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  if (!clerkClient) {
    console.warn('CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY is missing in environment variables.');
    return c.json({ success: false, message: 'Unauthorized: Server configuration error' }, 500);
  }

  try {
    const requestState = await clerkClient.authenticateRequest(c.req.raw);
    
    if (!requestState.isSignedIn) {
      return c.json({ success: false, message: 'Unauthorized: Token not verified' }, 401);
    }
    
    const authObj = requestState.toAuth();
    if (!authObj.userId) {
      return c.json({ success: false, message: 'Unauthorized: Token sub is missing' }, 401);
    }
    
    c.set('userId', authObj.userId);
    await next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return c.json({ success: false, message: 'Unauthorized: Token not verified' }, 401);
  }
});
