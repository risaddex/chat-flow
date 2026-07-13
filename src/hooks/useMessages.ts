import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Message, ReactionEvent } from '../types';

interface Reaction { emoji: string; occurred_at: string }

function extractReactions(msg: Message): ReactionEvent[] {
  const r = (msg.metadata as any)?.reactions as Reaction[] | undefined;
  if (!r || r.length === 0) return [];
  return r.map((reaction, i) => ({
    id: `${msg.id}-${i}`,
    message_id: msg.id,
    reaction_emoji: reaction.emoji,
    occurred_at: reaction.occurred_at,
  }));
}

function enrichMessage(msg: Message): Message {
  const meta = msg.metadata as any;
  return {
    ...msg,
    agent_name: msg.agent_name || meta?.agent_name || null,
    reactions: extractReactions(msg),
  };
}

const INITIAL_LIMIT = 20;
const LOAD_OLDER = 10;

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (start: number, end: number) => {
    if (!conversationId) return [];
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(start, end);
    return ((data as Message[]) || []).reverse().map(enrichMessage);
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const start = messages.length;
    const end = start + LOAD_OLDER - 1;
    const data = await fetchPage(start, end);
    if (data.length > 0) {
      setMessages(prev => [...data, ...prev]);
    }
    setHasMore(data.length === LOAD_OLDER);
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, messages.length, fetchPage]);

  const applyReactions = useCallback((msg: Message): Message => enrichMessage(msg), []);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    setMessages([]);
    setHasMore(true);

    fetchPage(0, INITIAL_LIMIT - 1).then(data => {
      setMessages(data);
      setHasMore(data.length === INITIAL_LIMIT);
      setLoading(false);
    });

    const channel = supabase
      .channel(`messages-${conversationId}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, applyReactions(payload.new as Message)]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = applyReactions(payload.new as Message);
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? updated : m)
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, fetchPage, applyReactions]);

  return { messages, loading, loadingOlder, hasMore, loadOlder };
}
