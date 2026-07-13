import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useOpenCases(businessId: string) {
  const [openConversationIds, setOpenConversationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!businessId) return;

    const fetchOpen = async () => {
      const { data } = await supabase
        .from('cases')
        .select('conversation_id')
        .eq('business_id', businessId)
        .eq('status', 'open');

      if (data) setOpenConversationIds(new Set(data.map(c => c.conversation_id)));
    };

    fetchOpen();

    const channel = supabase
      .channel(`open-cases-${businessId}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cases',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newCase = payload.new as { conversation_id: string; status: string };
          if (newCase.status === 'open') {
            setOpenConversationIds(prev => new Set(prev).add(newCase.conversation_id));
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as { conversation_id: string; status: string };
          setOpenConversationIds(prev => {
            const next = new Set(prev);
            if (updated.status === 'open') next.add(updated.conversation_id);
            else next.delete(updated.conversation_id);
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { conversation_id: string };
          setOpenConversationIds(prev => { const next = new Set(prev); next.delete(old.conversation_id); return next; });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId]);

  return openConversationIds;
}


