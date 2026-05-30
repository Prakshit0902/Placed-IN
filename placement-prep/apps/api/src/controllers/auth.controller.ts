import { Context } from 'hono';
import { Webhook } from 'svix';
import { supabase } from '../lib/supabase.js';

export const clerkWebhook = async (c: Context) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not configured');
    return c.json({ success: false, message: 'Server configuration error' }, 500);
  }

  // Get headers
  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ success: false, message: 'Error occurred -- no svix headers' }, 400);
  }

  // Get payload string
  const payloadString = await c.req.text();

  // Initialize webhook verifier
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(payloadString, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err: any) {
    console.error('Error verifying webhook:', err.message);
    return c.json({ success: false, message: 'Error verifying webhook' }, 400);
  }

  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Received Clerk webhook: ${eventType} for user ${id}`);

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { email_addresses, first_name, last_name, username } = evt.data;
    
    // Find primary email
    let email = '';
    if (email_addresses && email_addresses.length > 0) {
      const primaryEmailObj = email_addresses.find((e: any) => e.id === evt.data.primary_email_address_id) || email_addresses[0];
      email = primaryEmailObj.email_address;
    }

    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: id,
          email: email,
          full_name: fullName || username || email.split('@')[0],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting user to Supabase:', error);
        return c.json({ success: false, message: 'Database error' }, 500);
      }
    } catch (dbError) {
      console.error('Database exception:', dbError);
      return c.json({ success: false, message: 'Database exception' }, 500);
    }
  } else if (eventType === 'user.deleted') {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user from Supabase:', error);
        return c.json({ success: false, message: 'Database error' }, 500);
      }
    } catch (dbError) {
      console.error('Database exception:', dbError);
      return c.json({ success: false, message: 'Database exception' }, 500);
    }
  }

  return c.json({ success: true, message: 'Webhook processed' }, 200);
};

export const getMe = async (c: Context) => {
  // authMiddleware sets userId
  const userId = c.get('userId');
  
  if (!userId) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // not found
         return c.json({ success: false, message: 'User not found in database' }, 404);
      }
      throw error;
    }

    return c.json({ success: true, data: user });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return c.json({ success: false, message: error.message || 'Internal Server Error' }, 500);
  }
};
