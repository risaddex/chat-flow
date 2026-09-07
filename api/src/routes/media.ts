import { Context, Hono } from 'hono';
import { config } from '../config.js';
import { getBusinessByPhoneNumberId } from '../lib/business.js';
import { getSupabase } from '../lib/supabase.js';
import { machineAuth, operatorAuth } from '../middleware/api-auth.js';
import type { AppVariables } from '../types.js';

const app = new Hono<{ Variables: AppVariables }>();
const supabase = getSupabase();
const BUCKET = 'whatsapp-media';
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp)|audio\/(mpeg|ogg|mp4|aac)|video\/(mp4|quicktime)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel)|text\/csv)$/i;

function extFromMime(mime: string): string {
  const sub = mime.split('/')[1]?.split(';')[0]?.trim();
  if (!sub) return 'bin';
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'mpeg') return 'mp3';
  if (sub === 'quicktime') return 'mov';
  return sub.replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'bin';
}

function safeKey(value: string): string {
  return value.replace(/^wamid\./, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160);
}

async function upload(c: Context<{ Variables: AppVariables }>, businessId: string) {
  let form: Record<string, unknown>;
  try {
    form = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Expected multipart/form-data body' }, 400);
  }

  const file = form.file;
  const messageType = safeKey(String(form.message_type || 'unknown')) || 'unknown';
  const messageId = safeKey(String(form.wa_message_id || crypto.randomUUID()));
  if (!(file instanceof File)) return c.json({ error: 'Missing file field' }, 400);
  if (!messageId) return c.json({ error: 'Invalid wa_message_id' }, 400);

  const mime = String(form.mime_type || file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.test(mime)) return c.json({ error: 'Unsupported media type' }, 415);
  if (file.size < 1 || file.size > MAX_BYTES) return c.json({ error: 'File must be between 1 byte and 20 MB' }, 413);

  const day = new Date().toISOString().slice(0, 10);
  const path = `${businessId}/${day}/${messageType}/${messageId}.${extFromMime(mime)}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (error && !/already exists/i.test(error.message)) return c.json({ error: error.message }, 500);
  return c.json({ media_path: path, mime_type: mime, size_bytes: file.size }, error ? 200 : 201);
}

app.post('/upload', operatorAuth, async (c) => {
  const agent = c.get('agent');
  if (agent.role === 'viewer') return c.json({ error: 'Viewer cannot upload media' }, 403);
  return upload(c, agent.business_id);
});

app.post('/ingest', machineAuth, async (c) => {
  const phoneNumberId = c.req.header('X-WhatsApp-Phone-Number-Id');
  if (!phoneNumberId) return c.json({ error: 'Missing X-WhatsApp-Phone-Number-Id' }, 400);
  const businessId = await getBusinessByPhoneNumberId(phoneNumberId);
  if (!businessId) return c.json({ error: 'Unknown phone_number_id' }, 404);
  return upload(c, businessId);
});

app.get('/:messageId/url', operatorAuth, async (c) => {
  const agent = c.get('agent');
  const { data: message } = await supabase.from('messages').select('media_path')
    .eq('id', c.req.param('messageId')).eq('business_id', agent.business_id).maybeSingle();
  if (!message?.media_path) return c.json({ error: 'Media not found' }, 404);
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(message.media_path, config.mediaSignedUrlTtlSeconds);
  if (error || !data?.signedUrl) return c.json({ error: 'Unable to sign media URL' }, 500);
  return c.json({ url: data.signedUrl, expires_in: config.mediaSignedUrlTtlSeconds });
});

export { app as mediaRouter };
