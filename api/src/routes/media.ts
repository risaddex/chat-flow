import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
const supabase = getSupabase();
import { apiAuth } from '../middleware/api-auth.js';

const app = new Hono();

const BUCKET = 'media';

function extFromMime(mime: string): string {
  const sub = mime.split('/')[1]?.split(';')[0]?.trim();
  if (!sub) return 'bin';
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'mpeg') return 'mp3';
  if (sub === 'quicktime') return 'mov';
  return sub.replace(/[^a-z0-9]/gi, '') || 'bin';
}

function safeKey(waMessageId: string): string {
  return waMessageId.replace(/^wamid\./, '').replace(/[^a-zA-Z0-9_-]/g, '');
}

// Uploads a WhatsApp media file (sent from n8n after it downloads the authed
// binary from Meta) into the public 'media' bucket and returns the public URL.
app.post('/upload', apiAuth, async (c) => {
  let form: Record<string, unknown>;
  try {
    form = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Expected multipart/form-data body' }, 400);
  }

  const file = form['file'];
  const messageType = String(form['message_type'] || 'unknown');
  const waMessageId = String(form['wa_message_id'] || '');

  if (!(file instanceof File)) return c.json({ error: 'Missing file field' }, 400);
  if (!waMessageId) return c.json({ error: 'Missing wa_message_id' }, 400);

  const mime = String(form['mime_type'] || file.type || 'application/octet-stream');
  const ext = extFromMime(mime);
  const path = `${messageType}/${safeKey(waMessageId)}.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true });

  if (error) return c.json({ error: error.message }, 500);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return c.json({ media_url: data.publicUrl, path, mime_type: mime }, 201);
});

export { app as mediaRouter };
