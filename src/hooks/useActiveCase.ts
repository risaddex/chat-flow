import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Case } from '../types';

export function useActiveCase(conversationId: string) {
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);

    const fetchCase = async () => {
      const { data } = await supabase
        .from('cases')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'open')
        .maybeSingle();

      setCaseItem(data);
      setLoading(false);
    };

    fetchCase();

    const channel = supabase
      .channel(`case-${conversationId}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cases',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => { fetchCase(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  return { caseItem, loading };
}

