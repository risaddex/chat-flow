import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { operatorAuth } from '../middleware/api-auth.js';
import type { AppVariables } from '../types.js';
import { resolveState, takeoverState } from '../lib/domain.js';

const app = new Hono<{ Variables: AppVariables }>();

const takeoverSchema = z.object({
  conversation_id: z.string(),
});

app.post('/takeover', operatorAuth, zValidator('json', takeoverSchema), async (c) => {
  const { conversation_id } = c.req.valid('json');
  const agent = c.get('agent');
  if (agent.role === 'viewer') return c.json({ error: 'Viewer cannot take over conversations' }, 403);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, wa_id, customer_name')
    .eq('id', conversation_id)
    .eq('business_id', agent.business_id)
    .maybeSingle();

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
        business_id: agent.business_id,
        assigned_agent_id: agent.id,
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
    .update(takeoverState(agent.id))
    .eq('id', conversation_id)
    .eq('business_id', agent.business_id);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({
    case_id: caseItem?.id || null,
    ai_active: false,
    human_active: true,
  });
});

app.post('/resolve', operatorAuth, zValidator('json', takeoverSchema), async (c) => {
  const { conversation_id } = c.req.valid('json');
  const agent = c.get('agent');
  if (agent.role === 'viewer') return c.json({ error: 'Viewer cannot resolve conversations' }, 403);

  const { data: conversation } = await supabase
    .from('conversations')
    .update(resolveState())
    .eq('id', conversation_id)
    .eq('business_id', agent.business_id)
    .select('id')
    .maybeSingle();
  if (!conversation) return c.json({ error: 'Conversation not found' }, 404);

  await supabase
    .from('cases')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('conversation_id', conversation_id)
    .eq('business_id', agent.business_id)
    .eq('status', 'open');

  return c.json({ status: 'resolved' });
});

export { app as conversationsRouter };
