import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusiness } from '../context/BusinessContext';
import { useDebounce } from '../hooks/useDebounce';
import { getAvatarColor, getInitials } from '../lib/avatar';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import type { Case } from '../types';

const PAGE_SIZE = 20;

const PRIORITY_STYLE: Record<string, { badge: string; label: string }> = {
  urgent: { badge: 'bg-error-container text-on-error-container', label: 'URGENT' },
  high:   { badge: 'bg-error-container text-on-error-container', label: 'HIGH' },
  medium: { badge: 'bg-amber-100 text-amber-800', label: 'MEDIUM' },
  low:    { badge: 'bg-surface-container-high text-on-surface-variant', label: 'LOW' },
};

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  open:        { dot: 'bg-secondary', label: 'Open' },
  in_progress: { dot: 'bg-secondary', label: 'In Progress' },
  resolved:    { dot: 'bg-outline', label: 'Resolved' },
  closed:      { dot: 'bg-outline', label: 'Closed' },
};

export default function CasesPage() {
  const { business } = useBusiness();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sel, setSel] = useState<Case | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchCases = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    let query = supabase
      .from('cases')
      .select('*, conversations!inner(customer_name, wa_id)', { count: 'exact' })
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (debouncedSearch) query = query.or(`subject.ilike.%${debouncedSearch}%,conversations.customer_name.ilike.%${debouncedSearch}%,conversations.wa_id.ilike.%${debouncedSearch}%`);
    const start = (page - 1) * PAGE_SIZE;
    const { data, count } = await query.range(start, start + PAGE_SIZE - 1);
    setCases((data || []) as Case[]);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [business?.id, debouncedSearch, page]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const navigate = useNavigate();

  const handleSelect = (c: Case) => { setSel(c); };

  const handleChatClick = async () => {
    if (!sel || !business?.id) return;
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('business_id', business.id)
      .eq('wa_id', sel.conversations?.wa_id || '')
      .limit(1)
      .single();
    if (conv) navigate(`/dashboard/conversations/${conv.id}`);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Cases List */}
      <section className="flex-1 bg-white flex flex-col h-full border-r border-outline-variant min-w-0">
        <header className="p-gutter border-b border-outline-variant">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display-lg text-display-lg text-primary">Cases</h1>
          </div>
          <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
              <input type="text" placeholder="Search cases or contact name..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); setSel(null); }}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none text-body-md" />
            </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[480px]">
            <thead className="sticky top-0 bg-surface-container-low z-10">
              <tr>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Contact</th>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Case Title</th>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Urgency</th>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={4} className="px-gutter py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : cases.length === 0 ? (
                <tr><td colSpan={4} className="px-gutter py-16 text-center text-body-sm text-on-surface-variant">{search ? 'No cases found' : 'No cases yet'}</td></tr>
              ) : cases.map(c => {
                const contactName = c.conversations?.customer_name || c.conversations?.wa_id || 'Unknown';
                const waId = c.conversations?.wa_id || '';
                const ps = PRIORITY_STYLE[c.priority] || PRIORITY_STYLE.medium;
                const ss = STATUS_STYLE[c.status] || STATUS_STYLE.open;
                const isSelected = sel?.id === c.id;
                const avatarBg = getAvatarColor(waId || c.id);
                return (
                  <tr key={c.id} onClick={() => handleSelect(c)}
                    className={`hover:bg-surface-container-lowest cursor-pointer transition-colors group ${
                      isSelected ? 'bg-surface-container-low' : ''
                    }`}
                    style={isSelected ? { borderLeft: '4px solid #0058be' } : { borderLeft: '4px solid transparent' }}>
                    <td className="px-gutter py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                          <div className="w-full h-full flex items-center justify-center font-bold text-body-md leading-none text-white"
                            style={{ backgroundColor: avatarBg }}>
                            {getInitials(contactName, waId)}
                          </div>
                        </div>
                        <div className="font-title-sm text-primary truncate">{contactName}</div>
                      </div>
                    </td>
                    <td className="px-gutter py-4 text-body-md text-on-surface">{c.subject}</td>
                    <td className="px-gutter py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ps.badge}`}>
                        {ps.label}
                      </span>
                    </td>
                    <td className="px-gutter py-4">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${ss.dot}`} />
                        <span className="text-body-sm text-on-surface-variant">{ss.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} currentCount={cases.length} label="cases" onPageChange={p => setPage(p)} />
      </section>

      {/* Right Utility Panel — overlay on mobile, static column on desktop */}
      {sel ? (
        <aside className="fixed inset-0 z-50 bg-white flex flex-col h-full overflow-y-auto lg:static lg:z-auto lg:w-[350px] lg:min-w-[350px] lg:max-w-[350px] lg:shrink-0 lg:border-l lg:border-outline-variant">
          {/* Mobile back bar */}
          <div className="lg:hidden flex items-center gap-2 h-14 px-4 border-b border-outline-variant shrink-0">
            <button onClick={() => setSel(null)} aria-label="Back to cases" className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="font-title-sm text-on-surface font-semibold">Case</span>
          </div>
          {/* Header */}
          <div className="p-gutter flex flex-col items-start border-b border-outline-variant bg-surface-container-low/20">
            {(() => {
              const contactName = sel.conversations?.customer_name || sel.conversations?.wa_id || 'Unknown';
              const waId = sel.conversations?.wa_id || '';
              return (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-white shadow-md overflow-hidden mb-4 flex items-center justify-center font-bold text-headline-md leading-none mx-auto text-white"
                    style={{ backgroundColor: getAvatarColor(waId || sel.id) }}>
                    {getInitials(contactName, waId)}
                  </div>
                  <h2 className="font-headline-md text-headline-md text-primary w-full text-center">Case Details</h2>
                  <p className="text-body-md text-secondary font-medium mt-1 w-full text-center">ID: #{sel.id.slice(0, 8).toUpperCase()}</p>
                </>
              );
            })()}
          </div>

          {/* Case Summary */}
          {sel.description && (
            <div className="p-gutter border-b border-outline-variant">
              <h3 className="text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-4">Case Summary</h3>
              <p className="text-body-md text-on-surface leading-relaxed">{sel.description}</p>
            </div>
          )}

          {/* AI Suggestions */}
          {(() => {
            const suggestions = [sel.ai_suggestion_1, sel.ai_suggestion_2, sel.ai_suggestion_3].filter(Boolean);
            if (suggestions.length === 0) return null;
            return (
              <div className="p-gutter border-b border-outline-variant">
                <h3 className="text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-4">AI Suggestions</h3>
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      <p className="text-body-sm text-on-surface-variant">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Contact Details */}
          <div className="p-gutter">
            <h3 className="text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-4">Contact Details</h3>
            <div className="space-y-4">
              {(() => {
                const contactName = sel.conversations?.customer_name || sel.conversations?.wa_id || 'Unknown';
                const waId = sel.conversations?.wa_id || '';
                return (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                        style={{ backgroundColor: getAvatarColor(waId || sel.id) }}>
                        {getInitials(contactName, waId)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-title-sm text-on-surface truncate">{contactName}</p>
                      </div>
                      <button onClick={handleChatClick}
                        className="p-2 rounded-full hover:bg-surface-container-high transition-colors shrink-0">
                        <span className="material-symbols-outlined text-secondary text-[20px]">chat</span>
                      </button>
                    </div>
                    <div className="flex items-start gap-3 px-1">
                      <span className="material-symbols-outlined text-outline text-[20px]">phone_iphone</span>
                      <div>
                        <div className="text-xs text-on-surface-variant">WhatsApp</div>
                        <div className="text-body-md text-on-surface">{waId}</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="p-gutter mt-auto text-center border-t border-outline-variant/30">
            <p className="text-body-sm text-on-surface-variant italic">End of record</p>
          </div>
        </aside>
      ) : (
        <aside className="hidden lg:flex w-[350px] min-w-[350px] max-w-[350px] bg-white flex-col h-full items-center justify-center shrink-0 border-l border-outline-variant">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[28px]">folder_shared</span>
            </div>
            <p className="text-title-sm text-on-surface font-medium">Select a case</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">View details from the list</p>
          </div>
        </aside>
      )}
    </div>
  );
}
