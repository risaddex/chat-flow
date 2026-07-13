import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const shownNotifications = new Set<string>();

export function useCaseNotifications(businessId: string) {
  useEffect(() => {
    if (!businessId) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel(`case-notifications-${businessId}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `business_id=eq.${businessId}`,
      }, async (payload) => {
        const conv = payload.new as Record<string, unknown>;
        const unread = (conv.unread_count as number) || 0;
        if (unread === 0) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const convId = conv.id as string;
        if (shownNotifications.has(convId)) return;

        const { count } = await supabase
          .from('cases')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .eq('status', 'open');
        if (!count || count === 0) return;

        const name = (conv.customer_name as string) || (conv.wa_id as string) || 'Customer';

        shownNotifications.add(convId);
        setTimeout(() => shownNotifications.delete(convId), 5000);

        const notif = new Notification(`📩 ${name}`, {
          body: (conv.last_message_text as string) || 'New message',
          tag: convId,
          silent: false,
        });
        notif.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('navigate-conversation', { detail: { conversationId: convId } }));
          notif.close();
        };
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId]);
}
