import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { apiAuth } from '../middleware/api-auth.js';
import { getOrCreateBusiness } from '../lib/business.js';

const app = new Hono();

const lookupSchema = z.object({
  phone: z.string(),
});

const createSchema = z.object({
  phone: z.string(),
  title: z.string().default(''),
  summary: z.string().default(''),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  ai_suggestion_1: z.string().default(''),
  ai_suggestion_2: z.string().default(''),
  ai_suggestion_3: z.string().default(''),
});

const createManualSchema = z.object({
  phone: z.string(),
  customer_name: z.string().default(''),
  subject: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

app.post('/create-manual', apiAuth, zValidator('json', createManualSchema), async (c) => {
  const body = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('wa_id', body.phone)
    .eq('business_id', businessId)
    .maybeSingle();

  let conversationId: string;

  if (conv) {
    conversationId = conv.id;
    await supabase.from('conversations').update({ ai_active: false, human_active: true }).eq('id', conversationId);
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        business_id: businessId,
        wa_id: body.phone,
        customer_name: body.customer_name || null,
        status: 'open',
        ai_active: false,
        human_active: true,
      })
      .select('id')
      .single();

    if (convErr || !newConv) return c.json({ error: 'Failed to create conversation' }, 500);
    conversationId = newConv.id;
  }

  const { data: existingCase } = await supabase
    .from('cases')
    .select('id, subject')
    .eq('conversation_id', conversationId)
    .eq('status', 'open')
    .maybeSingle();

  if (existingCase) {
    return c.json({ error: `Cannot create a new case. There is already an open case: "${existingCase.subject}"` }, 409);
  }

  const { data: newCase, error } = await supabase
    .from('cases')
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      subject: body.subject,
      description: body.description || null,
      priority: body.priority,
      source: 'manual',
      status: 'open',
    })
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ case: newCase }, 201);
});

app.post('/lookup', apiAuth, zValidator('json', lookupSchema), async (c) => {
  const { phone } = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('wa_id', phone)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!conv) return c.json({ case: null });

  const { data: caseItem } = await supabase
    .from('cases')
    .select('*')
    .eq('conversation_id', conv.id)
    .eq('status', 'open')
    .maybeSingle();

  return c.json({ case: caseItem || null });
});

app.post('/create', apiAuth, zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, customer_name')
    .eq('wa_id', body.phone)
    .eq('business_id', businessId)
    .maybeSingle();

  let conversationId: string;

  if (conv) {
    conversationId = conv.id;
  } else {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        business_id: businessId,
        wa_id: body.phone,
        customer_name: null,
        status: 'open',
        ai_active: true,
        human_active: false,
      })
      .select('id')
      .single();

    if (!newConv) return c.json({ error: 'Failed to create conversation' }, 500);
    conversationId = newConv.id;
  }

  const { data: existingCase } = await supabase
    .from('cases')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'open')
    .maybeSingle();

  if (existingCase) {
    const { data: updated } = await supabase
      .from('cases')
      .update({
        subject: body.title || undefined,
        description: body.summary || undefined,
        priority: body.urgency,
        ai_suggestion_1: body.ai_suggestion_1 || null,
        ai_suggestion_2: body.ai_suggestion_2 || null,
        ai_suggestion_3: body.ai_suggestion_3 || null,
      })
      .eq('id', existingCase.id)
      .select('*')
      .single();

    // Opening/refreshing a case hands the conversation to a human (in sync with takeover).
    await supabase.from('conversations').update({ unread_count: 0, ai_active: false, human_active: true }).eq('id', conversationId);

    return c.json({ case: updated });
  }

  const { data: newCase, error } = await supabase
    .from('cases')
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      subject: body.title || 'Support Case',
      description: body.summary || null,
      priority: body.urgency,
      source: 'ai',
      ai_suggestion_1: body.ai_suggestion_1 || null,
      ai_suggestion_2: body.ai_suggestion_2 || null,
      ai_suggestion_3: body.ai_suggestion_3 || null,
      status: 'open',
    })
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Opening a case hands the conversation to a human (in sync with takeover).
  await supabase.from('conversations').update({ unread_count: 0, ai_active: false, human_active: true }).eq('id', conversationId);

  return c.json({ case: newCase }, 201);
});

export { app as casesRouter };
