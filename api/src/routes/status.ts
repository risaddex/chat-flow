import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { machineAuth } from '../middleware/api-auth.js';

const app = new Hono();

const storeStatusSchema = z.object({
  wa_message_id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed', 'reaction']),
  timestamp: z.string().regex(/^\d{10}$/, 'timestamp must be Unix seconds'),
  recipient_phone: z.string().default(''),
  reaction_emoji: z.string().default(''),
});

app.post('/store', machineAuth, zValidator('json', storeStatusSchema), async (c) => {
  const body = c.req.valid('json');
  const eventKey = `${body.wa_message_id}:${body.status}:${body.timestamp}:${body.reaction_emoji}`;

  if (body.status === 'reaction') {
    const { data: msg } = await supabase
      .from('messages')
      .select('id, conversation_id, metadata')
      .eq('wa_message_id', body.wa_message_id)
      .single();

    if (!msg) return c.json({ error: 'Message not found' }, 404);

    const reaction = { emoji: body.reaction_emoji, occurred_at: new Date(parseInt(body.timestamp) * 1000).toISOString() };
    const existingReactions = (msg.metadata as any)?.reactions || [];
    const updatedReactions = [...existingReactions, reaction];

    const { error: msgError } = await supabase
      .from('messages')
      .update({ metadata: { ...(msg.metadata as object || {}), reactions: updatedReactions } })
      .eq('id', msg.id);

    const { error: eventError } = await supabase
      .from('message_status_events')
      .upsert({
        event_key: eventKey,
        message_id: msg.id,
        event_type: 'reaction',
        reaction_emoji: body.reaction_emoji,
        occurred_at: new Date(parseInt(body.timestamp) * 1000).toISOString(),
        raw_payload: { emoji: body.reaction_emoji, phone: body.recipient_phone },
      }, { onConflict: 'event_key', ignoreDuplicates: true });

    if (msgError || eventError) return c.json({ error: (msgError || eventError)!.message }, 500);
    return c.json({ status: 'ok' }, 200);
  }

  const { data: msg } = await supabase
    .from('messages')
    .update({ status: body.status })
    .eq('wa_message_id', body.wa_message_id)
    .select('id')
    .single();

  if (!msg) return c.json({ status: 'skipped', reason: 'Message not found by wa_message_id' }, 200);

  const { error } = await supabase
    .from('message_status_events')
    .upsert({
      event_key: eventKey,
      message_id: msg.id,
      event_type: body.status,
      occurred_at: new Date(parseInt(body.timestamp) * 1000).toISOString(),
      raw_payload: { recipient_phone: body.recipient_phone },
    }, { onConflict: 'event_key', ignoreDuplicates: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ status: 'ok' }, 200);
});

export { app as statusRouter };
