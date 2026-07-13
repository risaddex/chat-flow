import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { apiAuth } from '../middleware/api-auth.js';
import { getOrCreateBusiness } from '../lib/business.js';

const app = new Hono();

const createContactSchema = z.object({
  wa_id: z.string().min(1),
  name: z.string().default(''),
  title: z.string().default(''),
});

app.post('/create', apiAuth, zValidator('json', createContactSchema), async (c) => {
  const body = c.req.valid('json');
  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('business_id', businessId)
    .eq('wa_id', body.wa_id)
    .maybeSingle();
  if (existing) return c.json({ error: 'A contact with this WhatsApp number already exists.' }, 409);

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      business_id: businessId,
      wa_id: body.wa_id,
      name: body.name || null,
      title: body.title || null,
    })
    .select('*')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ contact }, 201);
});

const updateContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().default(''),
  title: z.string().default(''),
});

app.post('/update', apiAuth, zValidator('json', updateContactSchema), async (c) => {
  const body = c.req.valid('json');
  const { data: contact, error } = await supabase
    .from('contacts')
    .update({ name: body.name || null, title: body.title || null })
    .eq('id', body.id)
    .select('*')
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!contact) return c.json({ error: 'Contact not found' }, 404);
  return c.json({ contact });
});

app.get('/lookup', apiAuth, async (c) => {
  const phone = c.req.query('phone');
  if (!phone) return c.json({ error: 'phone query param required' }, 400);

  const businessId = await getOrCreateBusiness();
  if (!businessId) return c.json({ error: 'No business configured' }, 500);

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, wa_id, phone, email, notes, tags')
    .eq('wa_id', phone)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!contact) return c.json({ found: false, contact: null });
  return c.json({ found: true, contact });
});

export { app as contactsRouter };
