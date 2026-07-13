import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

function createSupabaseClient() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
}

let _supabase: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createSupabaseClient();
  }
  return _supabase;
}
