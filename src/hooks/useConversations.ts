import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Conversation } from '../types';

const INITIAL_LIMIT = 20;
const LOAD_MORE = 10;

export function useConversations(businessId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const bidRef = useRef(businessId);
  bidRef.current = businessId;
  const fetchedRef = useRef(false);

  const refetch = useCallback(async () => {
    const bid = bidRef.current;
    if (!bid) return;
    setLoading(true);
    fetchedRef.current = false;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', bid)
      .order('last_message_at', { ascending: false })
      .range(0, INITIAL_LIMIT - 1);
    const result = data || [];
    setConversations(result);
    setHasMore(result.length === INITIAL_LIMIT);
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !bidRef.current || !fetchedRef.current) return;
    setLoadingMore(true);
    const start = conversations.length;
    const end = start + LOAD_MORE - 1;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', bidRef.current)
      .order('last_message_at', { ascending: false })
      .range(start, end);
    const result = data || [];
    if (result.length > 0) {
      setConversations(prev => [...prev, ...result]);
    }
    setHasMore(result.length === LOAD_MORE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, conversations.length]);

  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('business_id', businessId)
        .order('last_message_at', { ascending: false })
        .range(0, INITIAL_LIMIT - 1);

      if (cancelled) return;

      const result = data || [];
      setConversations(result);
      setHasMore(result.length === INITIAL_LIMIT);
      setLoading(false);
      fetchedRef.current = true;

      channel = supabase
        .channel(`conversations-${businessId}-${crypto.randomUUID()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${businessId}`,
        }, (payload) => {
          if (!fetchedRef.current) return;
          if (payload.eventType === 'INSERT') {
            setConversations(prev => {
              if (prev.some(c => c.id === (payload.new as Conversation).id)) return prev;
              return [payload.new as Conversation, ...prev]
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            });
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev => {
              const updated = payload.new as Conversation;
              const idx = prev.findIndex(c => c.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
              }
              return [updated, ...prev]
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            });
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== payload.old.id));
          }
        })
        .subscribe();
    };

    init();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [businessId]);

  return { conversations, loading, loadingMore, hasMore, refetch, loadMore };
}
