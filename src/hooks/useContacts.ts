import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types';

const PAGE_SIZE = 20;

export function useContacts(businessId: string, search = '', page = 1) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,wa_id.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    return query;
  }, [businessId, search]);

  const fetch = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const { data, count, error: err } = await buildQuery().range(start, end);
    if (err) { setError(err.message); setContacts([]); }
    else { setContacts(data || []); }
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [businessId, buildQuery, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { contacts, loading, error, totalPages, totalCount, page, refetch: fetch };
}
