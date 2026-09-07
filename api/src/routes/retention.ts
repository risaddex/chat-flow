import { Hono } from 'hono';
import { retentionCutoff } from '../lib/domain.js';
import { getSupabase } from '../lib/supabase.js';
import { machineAuth } from '../middleware/api-auth.js';

const app = new Hono();
const supabase = getSupabase();
const BUCKET = 'whatsapp-media';

app.post('/purge', machineAuth, async (c) => {
  const cutoff = retentionCutoff();
  // ponytail: capped batch keeps the request bounded; run it more often if backlog exceeds 1,000 messages/day.
  const { data: expired, error } = await supabase.from('messages')
    .select('id, media_path').lt('created_at', cutoff).limit(1_000);
  if (error) return c.json({ error: error.message }, 500);

  const paths = (expired || []).flatMap((message) => message.media_path ? [message.media_path] : []);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) return c.json({ error: storageError.message }, 500);
  }

  const ids = (expired || []).map((message) => message.id);
  if (ids.length) {
    const { error: deleteError } = await supabase.from('messages').delete().in('id', ids);
    if (deleteError) return c.json({ error: deleteError.message }, 500);
  }
  await supabase.from('internal_notes').delete().lt('created_at', cutoff);
  await supabase.from('cases').delete().lt('created_at', cutoff);
  await supabase.from('conversations').update({ last_message_text: null, unread_count: 0 })
    .lt('last_message_at', cutoff);

  return c.json({ cutoff, messages: ids.length, media: paths.length, has_more: ids.length === 1_000 });
});

export { app as retentionRouter };
