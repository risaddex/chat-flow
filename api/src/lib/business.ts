import { getSupabase } from './supabase.js';

export async function getBusinessByPhoneNumberId(phoneNumberId: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();
  return data?.id || null;
}
