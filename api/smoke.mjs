// Live smoke: temporary tenants/users only; no WhatsApp sends or secret output.
// Run: SMOKE_API_URL=https://chat.ivaisoft.com node api/smoke.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:18080';
const url = 'https://lorwmxxrxodonkxgmvzm.supabase.co';
const publicKey = 'sb_publishable_3G-rt4v1ztnjv2wbGQdIgg_VTb6OY9P';
function secret(name, key) {
  const data = JSON.parse(execFileSync('kubectl', ['--context', 'default', '-n', 'ivaisoft', 'get', 'secret', name, '-o', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] }));
  return Buffer.from(data.data[key], 'base64').toString();
}
const admin = createClient(url, secret('chat-flow-secrets', 'SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const machine = { 'X-Machine-Secret': secret('chat-flow-machine-secrets', 'API_MACHINE_SECRET') };
const run = randomUUID();
const tenants = [], users = [], clients = [], paths = [];
let stage = 'initialization';
function check(value, label) { assert.ok(value, label); console.log(`PASS ${label}`); }
async function db(query) {
  const result = await query;
  assert.ok(!result.error, `${stage}: database operation (${result.error?.code || result.error?.status || 'unknown'})`);
  return result.data;
}
async function request(path, body, headers = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body instanceof FormData ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  assert.equal(response.status, expected, `${stage}: ${path} HTTP status`);
  return response.json();
}
try {
  stage = 'health and unauthorized access';
  await request('/health');
  await request('/api/messages/store', {}, {}, 401);
  await request('/api/conversations/takeover', {}, {}, 401);
  await request('/api/conversations/takeover', {}, { Authorization: 'Bearer invalid' }, 401);
  check(true, stage);

  stage = 'temporary tenants and password login';
  for (let i = 0; i < 2; i++) {
    const business = (await db(admin.from('businesses').insert({ name: `Smoke ${run}`, whatsapp_phone_number_id: `smoke-${run}-${i}` }).select().single()));
    tenants.push(business);
    const email = `smoke-${run}-${i}@example.com`, password = randomBytes(32).toString('base64url');
    const { user } = await db(admin.auth.admin.createUser({ email, password, email_confirm: true }));
    users.push(user.id);
    await db(admin.from('agents').insert({ id: user.id, business_id: business.id, name: 'Smoke', email, role: i ? 'viewer' : 'admin' }));
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    const login = await db(client.auth.signInWithPassword({ email, password }));
    business.headers = { Authorization: `Bearer ${login.session.access_token}` };
  }
  check(true, stage);
  const [a, b] = tenants;
  stage = 'message ingestion and idempotency';
  const payload = { phone_number_id: a.whatsapp_phone_number_id, phone: '5511999990000', direction: 'inbound', name: 'Smoke', wa_message_id: `smoke-${run}`, message_type: 'text', content: 'Teste técnico sem envio ao WhatsApp.' };
  const first = await request('/api/messages/store', payload, machine, 201);
  const duplicate = await request('/api/messages/store', payload, machine);
  check(duplicate.idempotent && first.message_id === duplicate.message_id, 'duplicate does not create another message');
  const conversation = await db(admin.from('conversations').select().eq('id', first.conversation_id).single());
  check(conversation.unread_count === 1, 'unread incremented once');
  const rows = await db(clients[0].from('messages').select('id').eq('id', first.message_id));
  const foreignRows = await db(clients[1].from('messages').select('id').eq('id', first.message_id));
  check(rows.length === 1 && foreignRows.length === 0, 'RLS isolates tenants');
  await db(admin.from('agents').update({ role: 'admin' }).eq('id', users[1]));
  await request('/api/conversations/takeover', { conversation_id: first.conversation_id }, b.headers, 404);
  await db(admin.from('agents').update({ role: 'viewer' }).eq('id', users[0]));
  await request('/api/conversations/takeover', { conversation_id: first.conversation_id }, a.headers, 403);
  await db(admin.from('agents').update({ role: 'admin' }).eq('id', users[0]));
  check(true, 'API tenant and viewer guards');
  stage = 'takeover and resolve';
  await request('/api/messages/outbound', { conversation_id: first.conversation_id, content: 'Must not send' }, a.headers, 409);
  const takeover = await request('/api/conversations/takeover', { conversation_id: first.conversation_id }, a.headers);
  check(!takeover.ai_active && takeover.human_active && takeover.case_id, 'takeover disables AI and opens a case');
  await request('/api/conversations/resolve', { conversation_id: first.conversation_id }, a.headers);
  const resolved = await db(admin.from('conversations').select().eq('id', first.conversation_id).single());
  check(resolved.ai_active && !resolved.human_active && resolved.status === 'resolved', 'resolve restores AI');

  stage = 'status deduplication';
  const status = { wa_message_id: payload.wa_message_id, status: 'read', timestamp: String(Math.floor(Date.now() / 1000)) };
  await request('/api/status/store', status, machine);
  await request('/api/status/store', status, machine);
  check((await db(admin.from('message_status_events').select('id').eq('message_id', first.message_id))).length === 1, stage);

  stage = 'private media upload through frontend proxy';
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'application/pdf' }), 'smoke.pdf');
  form.set('message_type', 'document');
  form.set('wa_message_id', `smoke-media-${run}`);
  const uploaded = await request('/api/media/upload', form, a.headers, 201);
  paths.push(uploaded.media_path);
  const mediaMessage = await request('/api/messages/store', { ...payload, wa_message_id: `smoke-media-${run}`, message_type: 'document', media_path: uploaded.media_path, mime_type: 'application/pdf' }, machine, 201);
  const signed = await request(`/api/media/${mediaMessage.message_id}/url`, undefined, a.headers);
  await request(`/api/media/${mediaMessage.message_id}/url`, undefined, b.headers, 404);
  const download = await fetch(signed.url);
  check(signed.expires_in === 300 && download.status === 200, 'signed media token has 300-second TTL');
  await download.body?.cancel();
  check(!(await fetch(`${url}/storage/v1/object/public/whatsapp-media/${uploaded.media_path}`)).ok, 'media not public');

  if (process.env.SMOKE_SUMMARY === '1') {
    stage = 'API to n8n summary';
    const summary = await request('/api/messages/summarize', { conversation_id: first.conversation_id }, a.headers);
    check(typeof summary.summary === 'string' && summary.summary.trim().length > 0, stage);
  }
  stage = 'retention';
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  for (const [table, column] of [['messages', 'created_at'], ['internal_notes', 'created_at'], ['cases', 'created_at'], ['conversations', 'last_message_at']]) {
    const old = await db(admin.from(table).select('id').lt(column, cutoff).limit(1));
    assert.equal(old.length, 0, `Refusing retention smoke while unrelated expired ${table} exist`);
  }
  await db(admin.from('messages').update({ created_at: new Date(Date.now() - 31 * 86400000).toISOString() }).eq('id', mediaMessage.message_id));
  const purged = await request('/api/retention/purge', {}, machine);
  check(purged.messages === 1 && purged.media === 1, 'retention removed expired message and media');
  check((await db(admin.from('messages').select('id').eq('id', first.message_id))).length === 1, 'retention preserves recent messages');
  // Supabase CDN deletion invalidation can take up to one minute.
  const deadline = Date.now() + 65000;
  let readable;
  do {
    const response = await fetch(signed.url, { signal: AbortSignal.timeout(10000) });
    readable = response.ok;
    await response.body?.cancel();
    if (readable) await setTimeout(5000);
  } while (readable && Date.now() < deadline);
  check(!readable, 'expired media no longer downloadable after CDN invalidation');
} catch (error) {
  console.error(`FAIL ${stage} (no response bodies or secrets logged)`);
  console.error(JSON.stringify({ type: error.name, expected: typeof error.expected === 'number' ? error.expected : undefined, actual: typeof error.actual === 'number' ? error.actual : undefined, networkCode: error.cause?.code }));
  process.exitCode = 1;
} finally {
  stage = 'cleanup';
  const cleanupSteps = [
    ...paths.length ? [() => db(admin.storage.from('whatsapp-media').remove(paths))] : [],
    ...clients.map(client => () => db(client.auth.signOut({ scope: 'global' }))),
    ...tenants.map(tenant => () => db(admin.from('businesses').delete().eq('id', tenant.id))),
    ...users.map(id => () => db(admin.auth.admin.deleteUser(id))),
  ];
  let failures = 0;
  for (const step of cleanupSteps) {
    try { await step(); } catch { failures++; }
  }
  if (failures) {
    console.error(`FAIL cleanup: ${failures} operations failed; inspect temporary fixtures`);
    process.exitCode = 1;
  } else console.log('PASS temporary fixtures and sessions cleaned up');
}
