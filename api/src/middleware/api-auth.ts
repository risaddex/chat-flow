import type { Context, Next } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { getSupabase } from '../lib/supabase.js';
import type { AppVariables } from '../types.js';

function bearerToken(c: Context): string | null {
  const auth = c.req.header('Authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export function secretsMatch(value: string | undefined, expected: string): boolean {
  if (!value || !expected) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function operatorAuth(c: Context<{ Variables: AppVariables }>, next: Next) {
  const token = bearerToken(c);
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const supabase = getSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return c.json({ error: 'Unauthorized' }, 401);

  const { data: agent } = await supabase
    .from('agents')
    .select('id, business_id, name, email, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!agent?.business_id) return c.json({ error: 'Agent not configured' }, 403);

  c.set('agent', agent as AppVariables['agent']);
  await next();
}

export async function machineAuth(c: Context, next: Next) {
  if (!secretsMatch(c.req.header('X-Machine-Secret'), config.apiMachineSecret)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}
