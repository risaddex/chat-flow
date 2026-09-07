import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { config } from '../config.js';
import { getSupabase } from '../lib/supabase.js';
import { getBusinessByPhoneNumberId } from '../lib/business.js';
import { isBusinessMediaPath, isUniqueViolation, machineHeaders } from '../lib/domain.js';
import { machineAuth, operatorAuth } from '../middleware/api-auth.js';
import type { AppVariables } from '../types.js';

const app = new Hono<{ Variables: AppVariables }>();
const supabase = getSupabase();

const storeMessageSchema = z.object({
  phone_number_id: z.string().min(1),
  phone: z.string().regex(/^\d{8,15}$/),
  direction: z.enum(['inbound', 'outbound']),
  name: z.string().max(80).default(''),
  wa_message_id: z.string().min(1).max(255),
  message_type: z.enum(['text', 'image', 'voice', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction', 'unknown']),
  content: z.string().max(32768).default(''),
  media_path: z.string().max(1024).default(''),
  mime_type: z.string().max(255).default(''),
  media_size_bytes: z.coerce.number().int().min(0).max(20 * 1024 * 1024).optional(),
  sent_by: z.enum(['ai', 'human', 'system']).default('ai'),
  agent_id: z.string().uuid().optional(),
});

app.post('/store', machineAuth, zValidator('json', storeMessageSchema), async (c) => {
  const body = c.req.valid('json');
  const businessId = await getBusinessByPhoneNumberId(body.phone_number_id);
  if (!businessId) return c.json({ error: 'Unknown phone_number_id' }, 404);

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .upsert({
      business_id: businessId,
      wa_id: body.phone,
      customer_name: body.direction === 'inbound' && body.name ? body.name : undefined,
    }, { onConflict: 'business_id,wa_id' })
    .select('id, ai_active, human_active')
    .single();
  if (conversationError || !conversation) return c.json({ error: conversationError?.message || 'Conversation unavailable' }, 500);

  let agentId: string | null = null;
  if (body.direction === 'outbound' && body.agent_id) {
    const { data: agent } = await supabase.from('agents').select('id')
      .eq('id', body.agent_id).eq('business_id', businessId).maybeSingle();
    if (!agent) return c.json({ error: 'Agent does not belong to business' }, 403);
    agentId = agent.id;
  }

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      business_id: businessId,
      wa_message_id: body.wa_message_id,
      direction: body.direction,
      type: body.message_type,
      content: body.content || null,
      media_path: body.media_path || null,
      media_mime_type: body.mime_type || null,
      media_size_bytes: body.media_size_bytes || null,
      status: body.direction === 'inbound' ? 'received' : 'sent',
      sent_by: body.direction === 'outbound' ? body.sent_by : null,
      agent_id: agentId,
    })
    .select('id')
    .single();

  if (isUniqueViolation(messageError)) {
    const { data: existing } = await supabase.from('messages').select('id, conversation_id')
      .eq('wa_message_id', body.wa_message_id).single();
    return c.json({
      message_id: existing?.id,
      conversation_id: existing?.conversation_id,
      ai_active: conversation.ai_active,
      human_active: conversation.human_active,
      idempotent: true,
    });
  }
  if (messageError || !message) return c.json({ error: messageError?.message || 'Message unavailable' }, 500);

  const now = new Date().toISOString();
  const preview = body.content.slice(0, 100) || `[${body.message_type}]`;
  await supabase.from('conversations').update({
    customer_name: body.direction === 'inbound' && body.name ? body.name : undefined,
    last_message_at: now,
    last_message_text: preview,
    last_message_type: body.message_type,
    last_human_reply_at: body.direction === 'outbound' && body.sent_by === 'human' ? now : undefined,
    status: 'open',
  }).eq('id', conversation.id);
  if (body.direction === 'inbound') await supabase.rpc('increment_conversation_unread', { conv_id: conversation.id });

  const contact: Record<string, unknown> = { business_id: businessId, wa_id: body.phone, last_message_at: now };
  if (body.direction === 'inbound' && body.name) contact.name = body.name;
  await supabase.from('contacts').upsert(contact, { onConflict: 'business_id,wa_id' });

  return c.json({
    message_id: message.id,
    conversation_id: conversation.id,
    ai_active: conversation.ai_active,
    human_active: conversation.human_active,
    idempotent: false,
  }, 201);
});

const outboundSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().max(4096).default(''),
  message_type: z.enum(['text', 'image', 'audio', 'video', 'document']).default('text'),
  media_path: z.string().max(1024).default(''),
  mime_type: z.string().max(255).default(''),
  filename: z.string().max(255).default(''),
}).refine((value) => Boolean(value.content.trim() || value.media_path), 'content or media_path is required');

app.post('/outbound', operatorAuth, zValidator('json', outboundSchema), async (c) => {
  const body = c.req.valid('json');
  const agent = c.get('agent');
  if (agent.role === 'viewer') return c.json({ error: 'Viewer cannot send messages' }, 403);
  if (!config.n8nOutboundWebhookUrl || !config.n8nMachineSecret) return c.json({ error: 'Outbound integration not configured' }, 503);

  const { data: conversation } = await supabase.from('conversations').select('id, wa_id, human_active')
    .eq('id', body.conversation_id).eq('business_id', agent.business_id).maybeSingle();
  if (!conversation) return c.json({ error: 'Conversation not found' }, 404);
  if (!conversation.human_active) return c.json({ error: 'Take over the conversation before replying' }, 409);

  const { data: business } = await supabase.from('businesses').select('whatsapp_phone_number_id')
    .eq('id', agent.business_id).single();
  if (!business) return c.json({ error: 'Business not found' }, 404);

  let mediaUrl = '';
  if (body.media_path) {
    if (!isBusinessMediaPath(body.media_path, agent.business_id)) return c.json({ error: 'Invalid media path' }, 403);
    const { data, error } = await supabase.storage.from('whatsapp-media')
      .createSignedUrl(body.media_path, config.mediaSignedUrlTtlSeconds);
    if (error || !data?.signedUrl) return c.json({ error: 'Unable to sign media URL' }, 500);
    mediaUrl = data.signedUrl;
  }

  const response = await fetch(config.n8nOutboundWebhookUrl, {
    method: 'POST',
    headers: machineHeaders(config.n8nMachineSecret),
    body: JSON.stringify({
      business_id: agent.business_id,
      agent_id: agent.id,
      phone_number_id: business.whatsapp_phone_number_id,
      phone: conversation.wa_id,
      content: body.content,
      message_type: body.message_type,
      media_url: mediaUrl,
      media_path: body.media_path,
      mime_type: body.mime_type,
      filename: body.filename,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return c.json({ error: 'WhatsApp send failed', upstream_status: response.status }, 502);
  return c.json(result as Record<string, unknown>);
});

const summarizeSchema = z.object({
  conversation_id: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
});

app.post('/summarize', operatorAuth, zValidator('json', summarizeSchema), async (c) => {
  const { conversation_id, limit } = c.req.valid('json');
  const agent = c.get('agent');
  if (!config.n8nSummarizeWebhookUrl || !config.n8nMachineSecret) return c.json({ error: 'Summary integration not configured' }, 503);

  const { data: conversation } = await supabase.from('conversations').select('id')
    .eq('id', conversation_id).eq('business_id', agent.business_id).maybeSingle();
  if (!conversation) return c.json({ error: 'Conversation not found' }, 404);

  const { data: rows, error } = await supabase.from('messages')
    .select('direction, type, content, sent_by, created_at')
    .eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  const messages = (rows || []).reverse().map((message) => ({
    from: message.direction === 'inbound' ? 'customer' : message.sent_by === 'ai' ? 'ai' : 'agent',
    type: message.type,
    text: message.content || `[${message.type}]`,
    at: message.created_at,
  }));

  const response = await fetch(config.n8nSummarizeWebhookUrl, {
    method: 'POST',
    headers: machineHeaders(config.n8nMachineSecret),
    body: JSON.stringify({ conversation_id, messages }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return c.json({ error: 'Summary failed', upstream_status: response.status }, 502);
  return c.json(result as Record<string, unknown>);
});

app.get('/recent', machineAuth, async (c) => {
  const phone = c.req.query('phone');
  const phoneNumberId = c.req.query('phone_number_id');
  if (!phone || !phoneNumberId) return c.json({ error: 'phone and phone_number_id are required' }, 400);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '20', 10) || 20, 1), 50);
  const businessId = await getBusinessByPhoneNumberId(phoneNumberId);
  if (!businessId) return c.json({ error: 'Unknown phone_number_id' }, 404);

  const { data: conversation } = await supabase.from('conversations').select('id')
    .eq('wa_id', phone).eq('business_id', businessId).maybeSingle();
  if (!conversation) return c.json({ phone, count: 0, messages: [] });
  const { data, error } = await supabase.from('messages')
    .select('direction, type, content, sent_by, created_at')
    .eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(limit);
  if (error) return c.json({ error: error.message }, 500);
  const messages = (data || []).reverse().map((message) => ({
    from: message.direction === 'inbound' ? 'customer' : message.sent_by === 'ai' ? 'ai' : 'agent',
    type: message.type,
    text: message.content || `[${message.type}]`,
    at: message.created_at,
  }));
  return c.json({ phone, count: messages.length, messages });
});

export { app as messagesRouter };
