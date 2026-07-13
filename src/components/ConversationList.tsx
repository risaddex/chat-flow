import { useState, useEffect, useRef, useMemo } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useOpenCases } from '../hooks/useOpenCases';
import { getAvatarColor, getInitials } from '../lib/avatar';
import { fmtTime } from '../lib/format';
import Spinner from './Spinner';
import type { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  loading?: boolean;
}

export default function ConversationList({ conversations, selectedId, onSelect, onLoadMore, loadingMore, hasMore, loading }: Props) {
  const { business } = useBusiness();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [seenCaseConvIds, setSeenCaseConvIds] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const openCaseConvIds = useOpenCases(business?.id || '');

  const handleSelect = (id: string) => {
    setSeenCaseConvIds(prev => new Set(prev).add(id));
    onSelect(id);
  };

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) onLoadMore(); }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadMore, hasMore]);

  const uniqueConversations = useMemo(() => {
    const seen = new Set<string>();
    return conversations.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [conversations]);

  const filtered = uniqueConversations.filter(c => {
    const matchSearch = c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.wa_id.includes(search);
    const matchFilter = filter === 'all' || (filter === 'ai' && c.ai_active) || (filter === 'human' && c.human_active);
    return matchSearch && matchFilter;
  });

  return (
    <section className={`w-full lg:w-[360px] lg:min-w-[360px] lg:max-w-[360px] border-r border-outline-variant bg-white flex-col h-full shrink-0 overflow-hidden ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-gutter border-b border-outline-variant">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-md text-headline-md text-primary">Conversations</h2>
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
          <input
            type="text" placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent outline-none text-body-md"
          />
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'human', label: 'Human' },
            { key: 'ai', label: 'AI' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full cursor-pointer transition-colors ${
                filter === f.key
                  ? 'bg-secondary text-on-secondary text-xs font-bold'
                  : 'bg-surface-container text-on-surface-variant text-xs font-medium hover:bg-surface-container-high'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-body-sm text-on-surface-variant">
            {search ? 'No results' : 'No conversations'}
          </div>
        ) : (
          filtered.map(c => {
            const hasOpenCase = openCaseConvIds.has(c.id);
            const isSelected = selectedId === c.id;
            const name = c.customer_name || c.wa_id || 'Unknown';
            return (
              <div key={c.id} onClick={() => handleSelect(c.id)}
                className={`p-4 border-b border-outline-variant flex gap-3 cursor-pointer hover:bg-surface-container-low transition-colors relative ${
                  isSelected ? 'conversation-item active' : 'conversation-item'
                }`}>
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(c.wa_id) }}>
                  {getInitials(c.customer_name, c.wa_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-title-sm text-title-sm text-primary truncate">{name}</h3>
                    <span className="text-label-caps text-on-surface-variant">{fmtTime(c.last_message_at)}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant truncate">
                    {c.last_message_text || 'No messages'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {c.human_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                        <span className="material-symbols-outlined text-[12px] mr-1">person</span> Human Assigned
                      </span>
                    ) : c.ai_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <span className="material-symbols-outlined text-[12px] mr-1">smart_toy</span> AI Active
                      </span>
                    ) : hasOpenCase ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                        <span className="material-symbols-outlined text-[12px] mr-1">folder_shared</span> Open Case
                      </span>
                    ) : null}
                    {hasOpenCase && c.unread_count > 0 && !seenCaseConvIds.has(c.id) && (
                      <span className="ml-auto bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {c.unread_count > 99 ? '99+' : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {loadingMore && <div className="flex justify-center py-3"><Spinner size="sm" /></div>}
        {hasMore && <div ref={sentinelRef} className="h-1" />}
      </div>
    </section>
  );
}
