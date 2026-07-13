import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Case } from '../types';

const PAGE_SIZE = 20;

export function useCases(businessId: string, status?: string, page = 1) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    let query = supabase
      .from('cases')
      .select('*, conversations!inner(customer_name, wa_id), agents!cases_assigned_agent_id_fkey(name, email)', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('status', status);
    }
    return query;
  }, [businessId, status]);

  const fetch = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const { data, count, error: err } = await buildQuery().range(start, end);
    if (err) { setError(err.message); setCases([]); }
    else { setCases(data || []); }
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [businessId, buildQuery, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { cases, loading, error, totalPages, totalCount, page, refetch: fetch };
}
