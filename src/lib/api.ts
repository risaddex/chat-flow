const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN = import.meta.env.VITE_API_TOKEN || 'ps-dev-token';
const OUTBOUND_WEBHOOK = import.meta.env.VITE_N8N_OUTBOUND_WEBHOOK_URL || '';
const SUMMARIZE_WEBHOOK = import.meta.env.VITE_N8N_SUMMARIZE_WEBHOOK_URL || '';

/** Ask n8n to summarize the last `limit` messages of a conversation. */
export async function summarizeChat(phone: string, limit: number): Promise<string> {
  if (!SUMMARIZE_WEBHOOK) throw new Error('Summarize webhook not configured (VITE_N8N_SUMMARIZE_WEBHOOK_URL)');
  const res = await fetch(SUMMARIZE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, limit }),
  });
  if (!res.ok) throw new Error(`Summarize failed: ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return (data.summary || data.text || '').trim();
}

interface OutboundParams {
  phone: string;
  content: string;
  message_type?: string;
  media_url?: string;
  mime_type?: string;
  filename?: string;
}

/** Message type WhatsApp/our API expects, derived from a file's MIME type. */
export function mediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

/** Upload a file to Supabase storage (via the API) and return its public URL. */
export async function uploadMedia(file: File): Promise<{ media_url: string; mime_type: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('message_type', mediaTypeFromMime(file.type || ''));
  form.append('wa_message_id', 'outbound-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));
  form.append('mime_type', file.type || 'application/octet-stream');
  const res = await fetch(`${API}/api/media/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

/**
 * Send an outbound WhatsApp message (text or media) by calling the n8n outbound
 * webhook directly. n8n sends it on WhatsApp and logs it back via the API, so
 * the message appears in the thread via the realtime subscription.
 */
export async function sendOutbound(params: OutboundParams) {
  if (!OUTBOUND_WEBHOOK) throw new Error('Outbound webhook not configured (VITE_N8N_OUTBOUND_WEBHOOK_URL)');
  const body = { message_type: 'text', media_url: '', mime_type: '', filename: '', ...params };
  const res = await fetch(OUTBOUND_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Send failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function takeOverConversation(conversationId: string) {
  return apiPost('/api/conversations/takeover', { conversation_id: conversationId });
}

export async function resolveConversation(conversationId: string) {
  return apiPost('/api/conversations/resolve', { conversation_id: conversationId });
}

export async function createCase(params: {
  phone: string;
  title?: string;
  summary?: string;
  urgency?: 'low' | 'medium' | 'high';
  ai_suggestion_1?: string;
  ai_suggestion_2?: string;
  ai_suggestion_3?: string;
}) {
  return apiPost('/api/cases/create', params);
}

export async function lookupCase(phone: string) {
  return apiPost('/api/cases/lookup', { phone });
}

export async function createManualCase(params: {
  phone: string;
  customer_name?: string;
  subject: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}) {
  return apiPost('/api/cases/create-manual', params);
}

export async function createContact(params: { wa_id: string; name?: string; title?: string }) {
  return apiPost('/api/contacts/create', params);
}

export async function updateContact(params: { id: string; name?: string; title?: string }) {
  return apiPost('/api/contacts/update', params);
}
