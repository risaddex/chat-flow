import { useState } from 'react';
import { useActiveCase } from '../hooks/useActiveCase';
import { resolveConversation, summarizeChat } from '../lib/api';
import { useToast } from '../context/ToastContext';
import Spinner from './Spinner';
import type { Conversation } from '../types';

interface Props {
  conversation: Conversation;
  onUpdate: () => void;
}

function SummarizeSection({ phone }: { phone: string }) {
  const { showToast } = useToast();
  const [count, setCount] = useState(20);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setSummary('');
    try {
      const s = await summarizeChat(phone, count);
      setSummary(s || 'No summary returned.');
    } catch (e) {
      showToast('Summarize failed: ' + ((e as Error).message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-gutter border-b border-outline-variant">
      <h3 className="flex items-center gap-2 text-label-caps text-on-surface-variant mb-3 uppercase tracking-widest font-bold text-[11px]">
        <span className="material-symbols-outlined text-[16px] text-secondary">summarize</span>
        Summarize chat
      </h3>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-body-sm text-on-surface-variant">Last messages</span>
        <span className="text-body-sm font-semibold text-on-surface">{count}</span>
      </div>
      <input
        type="range" min={5} max={50} step={5} value={count}
        onChange={e => setCount(Number(e.target.value))}
        disabled={loading}
        aria-label="Number of messages to summarize"
        className="w-full accent-secondary cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-on-surface-variant mt-0.5">
        <span>5</span><span>50</span>
      </div>
      <button
        onClick={run}
        disabled={loading}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-secondary text-on-secondary rounded-xl font-title-sm hover:opacity-90 disabled:opacity-60 transition-all"
      >
        {loading ? <Spinner size="sm" color="border-white" /> : <span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
        {loading ? 'Summarizing…' : 'Summarize'}
      </button>
      {summary && (
        <div className="mt-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant">
          <p className="text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}

export default function SidePanel({ conversation, onUpdate }: Props) {
  const { showToast } = useToast();
  const { caseItem } = useActiveCase(conversation.id);
  const [resolving, setResolving] = useState(false);
  const suggestions = caseItem ? [caseItem.ai_suggestion_1, caseItem.ai_suggestion_2, caseItem.ai_suggestion_3].filter(Boolean) : [];

  const handleResolve = async () => {
    setResolving(true);
    try { await resolveConversation(conversation.id); onUpdate(); }
    catch (e) { showToast('Failed: ' + ((e as Error).message || 'Unknown')); }
    finally { setResolving(false); }
  };

  return (
    <aside className="hidden lg:flex w-[320px] min-w-[320px] max-w-[320px] border-l border-outline-variant bg-white flex-col h-full overflow-y-auto shrink-0">
      <SummarizeSection phone={conversation.wa_id} />

      {caseItem ? (
        <>
          <div className="p-gutter border-b border-outline-variant">
            <h2 className="text-label-caps text-on-surface-variant mb-4 uppercase tracking-widest font-bold text-[11px]">Case</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-body-sm text-on-surface-variant">Priority</span>
                <span className={`px-3 py-1 text-[11px] font-bold rounded-lg border uppercase ${
                  caseItem.priority === 'urgent' ? 'bg-error-container text-on-error-container border-red-200' :
                  caseItem.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                  caseItem.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}>
                  {caseItem.priority}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body-sm text-on-surface-variant">Case ID</span>
                <span className="font-title-sm text-title-sm">#{caseItem.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-body-md">Human Active</span>
              </div>
            </div>
          </div>

          {caseItem.description && (
            <div className="p-gutter bg-surface-container-low/30 border-b border-outline-variant">
              <h3 className="flex items-center gap-2 text-label-caps text-on-surface-variant mb-3 text-[11px] uppercase tracking-widest font-bold">
                <span className="material-symbols-outlined text-[16px] text-secondary">auto_awesome</span>
                Case Summary
              </h3>
              <div className="p-3 bg-white border border-outline-variant rounded-xl shadow-sm">
                <p className="text-body-sm text-on-surface leading-relaxed italic">"{caseItem.description}"</p>
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="p-gutter">
              <h3 className="text-label-caps text-on-surface-variant mb-4 uppercase tracking-widest font-bold text-[11px]">Suggested replies</h3>
              <div className="space-y-stack-md">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex gap-3 group cursor-pointer">
                    <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="text-body-sm text-on-surface group-hover:text-secondary transition-colors">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-gutter bg-surface-container-lowest mt-auto">
            <button onClick={handleResolve} disabled={resolving}
              className="w-full py-3 bg-red-50 text-red-700 border border-red-100 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-colors disabled:opacity-50">
              {resolving ? 'Closing...' : 'Close Case'}
            </button>
          </div>
        </>
      ) : (
        <div className="p-gutter text-center text-on-surface-variant">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">messaging</span>
          </div>
          <p className="text-title-sm text-on-surface font-medium">No active case</p>
          <p className="text-body-sm mt-0.5">Take over to create a case</p>
        </div>
      )}
    </aside>
  );
}
