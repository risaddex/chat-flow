import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages } from '../hooks/useMessages';
import { useActiveCase } from '../hooks/useActiveCase';
import { takeOverConversation, resolveConversation } from '../lib/api';
import { getAvatarColor, getInitials } from '../lib/avatar';
import { useToast } from '../context/ToastContext';
import MessageBubble from './MessageBubble';
import ReplyBar from './ReplyBar';
import Spinner from './Spinner';
import type { Conversation } from '../types';

interface Props {
  conversation: Conversation;
  onUpdate: () => void;
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const text = isToday
    ? 'Conversation Started Today'
    : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="flex justify-center my-6">
      <span className="px-4 py-1 bg-surface-container-high text-on-surface-variant text-[11px] font-bold uppercase tracking-widest rounded-full">{text}</span>
    </div>
  );
}

export default function ConversationThread({ conversation, onUpdate }: Props) {
  const { showToast } = useToast();
  const { messages, loading: messagesLoading, loadingOlder, hasMore, loadOlder } = useMessages(conversation.id);
  const { caseItem } = useActiveCase(conversation.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newCount, setNewCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevLenRef = useRef(0);
  const [takingOver, setTakingOver] = useState(false);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => { prevLenRef.current = 0; }, [conversation.id]);

  useEffect(() => {
    if (!loadOlder || !hasMore) return;
    const el = topSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingOlder) {
        prevScrollHeightRef.current = scrollRef.current?.scrollHeight || 0;
        loadOlder();
      }
    }, { rootMargin: '100px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadOlder, hasMore, loadingOlder]);

  useEffect(() => {
    if (!loadingOlder || !messages.length) return;
    if (prevScrollHeightRef.current > 0) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
    }
  }, [messages.length, loadingOlder]);

  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages.length) return;
    if (messages.length > prevLenRef.current && prevLenRef.current > 0) {
      if (isNearBottom) el.scrollTop = el.scrollHeight;
      else setNewCount(prev => prev + (messages.length - prevLenRef.current));
    } else if (prevLenRef.current === 0 && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
    }
    prevLenRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  const scrollToBottom = () => { const el = scrollRef.current; if (el) { el.scrollTop = el.scrollHeight; setNewCount(0); } };

  const [closing, setClosing] = useState(false);

  const handleTakeOver = async () => {
    setTakingOver(true);
    try { await takeOverConversation(conversation.id); onUpdate(); }
    catch (e) { showToast('Takeover failed: ' + ((e as Error).message || 'Unknown')); }
    finally { setTakingOver(false); }
  };

  const handleClose = async () => {
    setClosing(true);
    try { await resolveConversation(conversation.id); onUpdate(); }
    catch (e) { showToast('Failed to close case: ' + ((e as Error).message || 'Unknown')); }
    finally { setClosing(false); }
  };

  // A human is handling the conversation when it has been taken over / a case is open.
  const humanHandling = conversation.human_active || caseItem?.status === 'open';
  const displayName = conversation.customer_name || conversation.wa_id;

  const avatarColor = getAvatarColor(conversation.wa_id);

  const fmtHeaderSubtitle = () => {
    return conversation.wa_id;
  };

  const messageGroups = (() => {
    if (!messages.length) return [];
    const groups: { date: string; items: typeof messages }[] = [];
    let currentDate = '';
    let currentItems: typeof messages = [];
    messages.forEach(msg => {
      const d = new Date(msg.created_at).toDateString();
      if (d !== currentDate) {
        if (currentItems.length) groups.push({ date: currentDate, items: currentItems });
        currentDate = d;
        currentItems = [];
      }
      currentItems.push(msg);
    });
    if (currentItems.length) groups.push({ date: currentDate, items: currentItems });
    return groups;
  })();

  return (
    <section className="flex-1 flex flex-col bg-surface overflow-hidden min-w-0">
      <header className="h-16 px-gutter flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-outline-variant sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => navigate('/dashboard/conversations')} aria-label="Back to conversations"
            className="lg:hidden p-1 -ml-1 text-on-surface-variant hover:bg-surface-container-low rounded-lg shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: avatarColor }}>
            {getInitials(conversation.customer_name, conversation.wa_id)}
          </div>
          <div className="min-w-0">
            <h2 className="font-title-sm text-title-sm text-primary leading-none truncate">{displayName}</h2>
            <span className="text-xs text-emerald-600 font-medium">{fmtHeaderSubtitle()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {humanHandling ? (
            <button onClick={handleClose} disabled={closing}
              className="px-3 sm:px-4 py-2 rounded-lg font-title-sm flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-all">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span className="hidden sm:inline">{closing ? 'Closing...' : 'Close Case'}</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <span className="hidden sm:inline">AI Active</span>
            </span>
          )}
        </div>
      </header>

      <div ref={scrollRef} onScroll={checkNearBottom} className="flex-1 overflow-y-auto p-gutter space-y-stack-md">
        {messagesLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-body-sm text-on-surface-variant">No messages yet</div>
        ) : (
          <div>
            {hasMore && <div ref={topSentinelRef} className="h-1" />}
            {loadingOlder && <div className="flex justify-center py-3"><Spinner size="sm" /></div>}
            {!hasMore && messages.length > 0 && (
              <DateDivider date={messages[0].created_at} />
            )}
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && <DateDivider date={group.items[0].created_at} />}
                {group.items.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {newCount > 0 && (
        <div className="flex justify-center -mt-1 mb-0.5 relative z-10">
          <button onClick={scrollToBottom}
            className="bg-white border border-outline-variant rounded-full px-3 py-1 text-[11px] font-bold text-on-surface-variant shadow-sm transition-colors">
            ↓ {newCount} new
          </button>
        </div>
      )}

      <ReplyBar phone={conversation.wa_id} canReply={humanHandling} onTakeOver={handleTakeOver} takingOver={takingOver} customerName={displayName} />
    </section>
  );
}
