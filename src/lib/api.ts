import { supabase } from './supabase';

const API = import.meta.env.VITE_API_URL || '';

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Authentication required');
  return data.session.access_token;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || `Request failed: ${response.status}`);
  }
  return response;
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function summarizeChat(conversationId: string, limit: number): Promise<string> {
  const data = await apiPost('/api/messages/summarize', { conversation_id: conversationId, limit });
  return String((data as { summary?: string; text?: string }).summary || (data as { text?: string }).text || '').trim();
}

export function mediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export async function uploadMedia(file: File): Promise<{ media_path: string; mime_type: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('message_type', mediaTypeFromMime(file.type || ''));
  form.append('wa_message_id', `outbound-${crypto.randomUUID()}`);
  form.append('mime_type', file.type || 'application/octet-stream');
  const response = await apiFetch('/api/media/upload', { method: 'POST', body: form });
  return response.json();
}

export async function getMediaUrl(messageId: string): Promise<string> {
  const response = await apiFetch(`/api/media/${encodeURIComponent(messageId)}/url`);
  const data = await response.json() as { url: string };
  return data.url;
}

interface OutboundParams {
  conversation_id: string;
  content: string;
  message_type?: string;
  media_path?: string;
  mime_type?: string;
  filename?: string;
}

export async function sendOutbound(params: OutboundParams) {
  return apiPost('/api/messages/outbound', params as unknown as Record<string, unknown>);
}

export async function takeOverConversation(conversationId: string) {
  return apiPost('/api/conversations/takeover', { conversation_id: conversationId });
}

export async function resolveConversation(conversationId: string) {
  return apiPost('/api/conversations/resolve', { conversation_id: conversationId });
}

export async function createManualCase(params: Record<string, unknown>) {
  return apiPost('/api/cases/create-manual', params);
}

export async function createContact(params: { wa_id: string; name?: string; title?: string }) {
  return apiPost('/api/contacts/create', params);
}

export async function updateContact(params: { id: string; name?: string; title?: string }) {
  return apiPost('/api/contacts/update', params);
}
