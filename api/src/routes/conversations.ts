import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { apiAuth } from '../middleware/api-auth.js';
import { getOrCreateBusiness } from '../lib/business.js';

const app = new Hono();

const takeoverSchema = z.object({
  conversation_id: z.string(),
});

app.post('/takeover', apiAuth, zValidator('json', takeoverSchema), async (c) => {
  const { conversation_id } = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, wa_id, customer_name')
    .eq('id', conversation_id)
    .eq('business_id', businessId)
    .single();

  if (!conv) return c.json({ error: 'Conversation not found' }, 404);

  const { data: existingCase } = await supabase
    .from('cases')
    .select('id')
    .eq('conversation_id', conversation_id)
    .eq('status', 'open')
    .maybeSingle();

  let caseItem = existingCase;

  if (!existingCase) {
    const customerName = conv.customer_name || conv.wa_id;
    const { data: newCase } = await supabase
      .from('cases')
      .insert({
        conversation_id,
        business_id: businessId,
        subject: `Support for ${customerName}`,
        description: `Manual takeover - conversation with ${customerName}`,
        source: 'manual',
        priority: 'medium',
        status: 'open',
      })
      .select('id')
      .single();

    caseItem = newCase;
  }

  const { error } = await supabase
    .from('conversations')
    .update({ ai_active: false, human_active: true, unread_count: 0 })
    .eq('id', conversation_id);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    case_id: caseItem?.id || null,
    ai_active: false,
    human_active: true,
  });
});

app.post('/resolve', apiAuth, zValidator('json', takeoverSchema), async (c) => {
  const { conversation_id } = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  await supabase
    .from('conversations')
    .update({ ai_active: true, human_active: false })
    .eq('id', conversation_id)
    .eq('business_id', businessId);

  await supabase
    .from('cases')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('conversation_id', conversation_id)
    .eq('status', 'open');

  return c.json({ status: 'resolved' });
});

export { app as conversationsRouter };
