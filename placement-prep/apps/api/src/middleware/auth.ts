import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';

export type AuthEnv = {
  Variables: {
    userId: string;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Unauthorized: Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    console.warn('CLERK_SECRET_KEY is missing in environment variables.');
  }

  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: secretKey,
    });
    
    if (!verifiedToken.sub) {
      return c.json({ success: false, message: 'Unauthorized: Token sub is missing' }, 401);
    }
    
    // verifiedToken.sub contains the user ID from Clerk
    c.set('userId', verifiedToken.sub);
    await next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return c.json({ success: false, message: 'Unauthorized: Token not verified' }, 401);
  }
});
