import type { Context, Next } from 'hono';
import { config } from '../config.js';

export async function apiAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== config.apiBearerToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
}
