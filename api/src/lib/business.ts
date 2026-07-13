import { getSupabase } from './supabase.js';

export async function getOrCreateBusiness() {
  const supabase = getSupabase();
  const { data: biz } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
  if (biz) return biz.id;
  const { data: created } = await supabase.from('businesses').insert({ name: 'Default', whatsapp_phone_number_id: '0' }).select('id').single();
  return created?.id || null;
}
