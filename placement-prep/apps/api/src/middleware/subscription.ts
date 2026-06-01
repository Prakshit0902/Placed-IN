import { createMiddleware } from 'hono/factory';
import { supabase } from '../lib/supabase.js';
import { AuthEnv } from './auth.js';

export type SubscriptionEnv = AuthEnv & {
  Variables: {
    subscriptionTier: string;
  };
};

export const requireSubscription = (requiredTiers: string[]) => {
  return createMiddleware<SubscriptionEnv>(async (c, next) => {
    const userId = c.var.userId;
    if (!userId) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return c.json({ success: false, message: 'User not found in database' }, 404);
      }

      const tier = user.subscription_tier || 'free';
      c.set('subscriptionTier', tier);

      if (!requiredTiers.includes(tier)) {
        return c.json({ 
          success: false, 
          message: `Forbidden: Requires one of ${requiredTiers.join(', ')} subscription` 
        }, 403);
      }

      await next();
    } catch (error) {
      console.error('Subscription check failed:', error);
      return c.json({ success: false, message: 'Internal Server Error' }, 500);
    }
  });
};
