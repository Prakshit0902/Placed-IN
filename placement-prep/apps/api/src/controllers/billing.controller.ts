import { Context } from 'hono';
import { supabase } from '../lib/supabase.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export const createOrder = async (c: Context) => {
  const userId = c.get('userId');
  
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }
  
  const { plan } = body;
  
  // Mapping plans to INR paise
  const PLAN_PRICES: Record<string, number> = {
      'monthly': 49900, // ₹499
      'quarterly': 129900, // ₹1299
      'yearly': 399900, // ₹3999
      'lifetime': 999900 // ₹9999
  };
  
  if (!plan || !PLAN_PRICES[plan]) {
      return c.json({ success: false, message: 'Invalid plan selected' }, 400);
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
  });

  try {
    const options = {
      amount: PLAN_PRICES[plan],
      currency: "INR",
      receipt: `receipt_${userId.substring(0, 8)}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    
    // Store pending subscription
    await supabase.from('subscriptions').insert({
        user_id: userId,
        razorpay_order_id: order.id,
        plan: plan,
        amount_paid: options.amount,
        status: 'pending'
    });

    return c.json({ success: true, order_id: order.id, amount: options.amount, currency: options.currency });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return c.json({ success: false, message: 'Failed to create order' }, 500);
  }
};

export const verifyPayment = async (c: Context) => {
  const userId = c.get('userId');
  let body;
  
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid JSON body' }, 400);
  }
  
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return c.json({ success: false, message: 'Missing payment details' }, 400);
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  
  // Verify signature
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generated_signature !== razorpay_signature) {
      return c.json({ success: false, message: 'Invalid payment signature' }, 400);
  }

  try {
      // Get the pending subscription
      const { data: sub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('razorpay_order_id', razorpay_order_id)
          .eq('user_id', userId)
          .single();
          
      if (!sub) {
          return c.json({ success: false, message: 'Subscription record not found' }, 404);
      }
      
      // Calculate expiry
      const now = new Date();
      let expires_at = new Date();
      
      if (sub.plan === 'monthly') expires_at.setMonth(now.getMonth() + 1);
      else if (sub.plan === 'quarterly') expires_at.setMonth(now.getMonth() + 3);
      else if (sub.plan === 'yearly') expires_at.setFullYear(now.getFullYear() + 1);
      else if (sub.plan === 'lifetime') expires_at.setFullYear(now.getFullYear() + 100);
      
      // Update subscription
      await supabase.from('subscriptions').update({
          razorpay_payment_id,
          razorpay_signature,
          status: 'active',
          started_at: now.toISOString(),
          expires_at: expires_at.toISOString()
      }).eq('id', sub.id);
      
      // Upgrade user tier
      const tier = sub.plan === 'lifetime' ? 'enterprise' : 'premium';
      await supabase.from('users').update({
          subscription_tier: tier,
          subscription_expires_at: expires_at.toISOString(),
          updated_at: now.toISOString()
      }).eq('id', userId);
      
      return c.json({ success: true, message: 'Payment verified and subscription activated' });
  } catch (error: any) {
      console.error('Error verifying payment:', error);
      return c.json({ success: false, message: 'Database error while activating subscription' }, 500);
  }
};

export const getSubscriptionStatus = async (c: Context) => {
    const userId = c.get('userId');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('subscription_tier, subscription_expires_at')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        return c.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching subscription status:', error);
        return c.json({ success: false, message: 'Internal server error' }, 500);
    }
};
