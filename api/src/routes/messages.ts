import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { apiAuth } from '../middleware/api-auth.js';
import { getOrCreateBusiness } from '../lib/business.js';

const app = new Hono();

const storeMessageSchema = z.object({
  phone: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  name: z.string().default(''),
  wa_message_id: z.string(),
  message_type: z.enum(['text', 'image', 'voice', 'audio', 'video', 'document', 'sticker', 'location', 'reaction', 'unknown']),
  content: z.string().default(''),
  media_url: z.string().default(''),
  mime_type: z.string().default(''),
  media_filename: z.string().default(''),
  sent_by: z.enum(['ai', 'human']).default('ai'),
});

app.post('/store', apiAuth, zValidator('json', storeMessageSchema), async (c) => {
  const body = c.req.valid('json');

  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id, ai_active, human_active')
    .eq('wa_id', body.phone)
    .eq('business_id', businessId)
    .maybeSingle();

  let conversationId: string;
  let humanActive = false;
  let aiActive = true;

  const preview = body.content.slice(0, 100) || (body.message_type !== 'text' ? `[${body.message_type}]` : '');

  if (existingConv) {
    conversationId = existingConv.id;
    humanActive = existingConv.human_active ?? false;
    aiActive = existingConv.ai_active ?? true;
    const convUpdate: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      last_message_text: preview,
      last_message_type: body.message_type,
      status: 'open',
    };
    if (body.direction === 'inbound') convUpdate.customer_name = body.name || null;
    await supabase
      .from('conversations')
      .update(convUpdate)
      .eq('id', conversationId);

    if (body.direction === 'inbound') {
      await supabase.rpc('increment_conversation_unread', { conv_id: conversationId });
    }
  } else {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        business_id: businessId,
        wa_id: body.phone,
        customer_name: body.name || null,
        status: 'open',
        ai_active: true,
        human_active: false,
        last_message_at: new Date().toISOString(),
        last_message_text: preview,
        last_message_type: body.message_type,
        unread_count: body.direction === 'inbound' ? 1 : 0,
      })
      .select('id')
      .single();

    if (!newConv) return c.json({ error: 'Failed to create conversation' }, 500);
    conversationId = newConv.id;
  }

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('wa_id', body.phone)
    .eq('business_id', businessId)
    .maybeSingle();

  const contactUpdate: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
  };
  if (body.direction === 'inbound') contactUpdate.name = body.name || undefined;
  if (existingContact) {
    await supabase
      .from('contacts')
      .update(contactUpdate)
      .eq('id', existingContact.id);
  } else {
    await supabase
      .from('contacts')
      .insert({
        business_id: businessId,
        wa_id: body.phone,
        ...contactUpdate,
        name: (body.direction === 'inbound' ? (body.name || null) : null),
        last_message_at: new Date().toISOString(),
      });
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      wa_message_id: body.wa_message_id,
      direction: body.direction,
      type: body.message_type,
      content: body.content || null,
      media_url: body.media_url || null,
      media_mime_type: body.mime_type || null,
      status: body.direction === 'inbound' ? 'received' : 'sent',
      sent_by: body.direction === 'outbound' ? body.sent_by : null,
    })
    .select('id')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({
    message_id: message.id,
    conversation_id: conversationId,
    ai_active: aiActive,
    human_active: humanActive,
  }, 201);
});

const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1),
});

app.post('/send', apiAuth, zValidator('json', sendMessageSchema), async (c) => {
  const { conversation_id, content } = c.req.valid('json');

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, business_id, wa_id')
    .eq('id', conversation_id)
    .maybeSingle();

  if (convErr || !conv) return c.json({ error: 'Conversation not found' }, 404);

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conv.id,
      business_id: conv.business_id,
      direction: 'outbound',
      type: 'text',
      content,
      status: 'processing',
      sent_by: 'human',
    })
    .select('id')
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message_id: message?.id || null }, 201);
});

// Returns the last N messages for a phone (for the n8n chat-summarizer flow).
app.get('/recent', apiAuth, async (c) => {
  const phone = c.req.query('phone');
  if (!phone) return c.json({ error: 'phone query param required' }, 400);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '20', 10) || 20, 1), 50);

  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('wa_id', phone)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!conv) return c.json({ phone, count: 0, messages: [] });

  const { data, error } = await supabase
    .from('messages')
    .select('id, direction, type, content, sent_by, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return c.json({ error: error.message }, 500);

  const messages = (data || []).reverse().map(m => ({
    from: m.direction === 'inbound' ? 'customer' : (m.sent_by === 'ai' ? 'ai' : 'agent'),
    type: m.type,
    text: m.content || `[${m.type}]`,
    at: m.created_at,
  }));

  return c.json({ phone, count: messages.length, messages });
});

export { app as messagesRouter };
