import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useBusiness } from '../context/BusinessContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DayCount { date: string; count: number; }

export default function AnalyticsPage() {
  const { business } = useBusiness();
  const [preset, setPreset] = useState<'7d' | '30d' | 'custom'>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openCases, setOpenCases] = useState(0);
  const [inProgress, setInProgress] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [closed, setClosed] = useState(0);
  const [total, setTotal] = useState(0);
  const [ai, setAi] = useState(0);
  const [manual, setManual] = useState(0);
  const [msgsIn, setMsgsIn] = useState(0);
  const [msgsAi, setMsgsAi] = useState(0);
  const [msgsHuman, setMsgsHuman] = useState(0);
  const [volume, setVolume] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedPreset, setAppliedPreset] = useState<'7d' | '30d' | 'custom'>('7d');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const loadedRef = useRef(false);

  const label = appliedPreset === '7d' ? '7 Days' : appliedPreset === '30d' ? '30 Days' : 'Custom';

  const fetchData = useCallback((p: string, f: string, t: string) => {
    if (!business?.id) return;
    const days = p === '7d' ? 7 : p === '30d' ? 30 : (() => {
      if (!f || !t) return 7;
      const diff = Math.ceil((new Date(t).getTime() - new Date(f).getTime()) / 86400000);
      return Math.min(Math.max(diff, 1), 90);
    })();
    const df = p === '7d'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : p === '30d'
        ? new Date(Date.now() - 30 * 86400000).toISOString()
        : f ? new Date(f).toISOString() : new Date(Date.now() - 7 * 86400000).toISOString();
    const dt = p === 'custom' && t ? new Date(t + 'T23:59:59').toISOString() : new Date().toISOString();

    setLoading(true);
    supabase.rpc('get_analytics', { p_business_id: business.id, p_from: df, p_to: dt }).then(({ data }) => {
      if (!data) { setLoading(false); return; }
      setOpenCases(data.open_cases ?? 0);
      setInProgress(data.in_progress_cases ?? 0);
      setResolved(data.resolved_cases ?? 0);
      setClosed(data.closed_cases ?? 0);
      setTotal(data.total_cases ?? 0);
      setAi(data.ai_cases ?? 0);
      setManual(data.manual_cases ?? 0);
      setMsgsIn(data.inbound_messages ?? 0);
      setMsgsAi(data.ai_messages ?? 0);
      setMsgsHuman(data.human_messages ?? 0);

      const now = new Date();
      const buckets: DayCount[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets.push({ date: key.slice(5), count: 0 });
      }
      const volumeData = (data.volume ?? []) as { date: string; count: number }[];
      volumeData.forEach(row => {
        const b = buckets.find(b => b.date === row.date.slice(5));
        if (b) b.count = row.count;
      });
      setVolume(buckets);
      setLoading(false);
    });
  }, [business?.id]);

  useEffect(() => {
    if (!business?.id || loadedRef.current) return;
    loadedRef.current = true;
    fetchData('7d', '', '');
  }, [business?.id, fetchData]);

  useEffect(() => {
    if (loadedRef.current && business?.id) fetchData(appliedPreset, appliedFrom, appliedTo);
  }, [appliedPreset, appliedFrom, appliedTo, business?.id, fetchData]);

  const applyCustom = () => {
    setAppliedPreset('custom');
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const selectPreset = (p: '7d' | '30d' | 'custom') => {
    setPreset(p);
    if (p !== 'custom') {
      setAppliedPreset(p);
      setAppliedFrom('');
      setAppliedTo('');
    }
  };

  const aiPct = total > 0 ? Math.round((ai / total) * 100) : 0;
  const responseRatio = msgsIn > 0 ? Math.round((msgsAi / msgsIn) * 100) : 0;
  const allCases = openCases + inProgress + resolved + closed;
  const openPct = allCases > 0 ? Math.round((openCases / allCases) * 100) : 0;
  const ipPct = allCases > 0 ? Math.round((inProgress / allCases) * 100) : 0;
  const resPct = allCases > 0 ? Math.round((resolved / allCases) * 100) : 0;
  const clPct = allCases > 0 ? 100 - openPct - ipPct - resPct : 0;

  return (
    <div className="w-full p-6 space-y-5 bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background">Analytics Overview</h2>
          <p className="text-on-surface-variant font-body-md">Operational performance metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-container-high p-1 rounded-lg">
            {(['7d', '30d', 'custom'] as const).map(p => (
              <button key={p} onClick={() => selectPreset(p)}
                className={`px-3 py-1 text-body-sm font-semibold rounded-md transition-all ${
                  preset === p ? 'bg-white shadow-sm text-secondary' : 'hover:bg-white/50'
                }`}>
                {p === '7d' ? '7D' : p === '30d' ? '30D' : 'Custom'}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="text-body-sm border border-outline-variant rounded-lg px-2 py-1 bg-white text-on-surface focus:ring-1 focus:ring-secondary outline-none" />
              <span className="text-body-sm text-on-surface-variant">to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="text-body-sm border border-outline-variant rounded-lg px-2 py-1 bg-white text-on-surface focus:ring-1 focus:ring-secondary outline-none" />
              <button onClick={applyCustom}
                className="px-3 py-1 bg-secondary text-white text-body-sm font-semibold rounded-lg hover:bg-secondary/90 transition-colors">
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Open Cases', value: openCases, icon: 'pending_actions', color: 'bg-amber-100 text-amber-700', sub: 'Awaiting reply' },
          { label: 'In Progress', value: inProgress, icon: 'autorenew', color: 'bg-blue-100 text-blue-700', sub: 'Being handled' },
          { label: 'Resolved', value: resolved, icon: 'task_alt', color: 'bg-green-100 text-green-700', sub: label },
          { label: 'Closed', value: closed, icon: 'archive', color: 'bg-slate-100 text-slate-600', sub: 'Archived' },
          { label: 'Total Cases', value: total, icon: 'inventory_2', color: 'bg-purple-100 text-purple-700', sub: 'Lifetime' },
        ].map(k => (
          <div key={k.label} className="bg-white p-3.5 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`p-1 rounded-md ${k.color}`}>
                <span className="material-symbols-outlined text-base">{k.icon}</span>
              </span>
              <span className="text-on-surface-variant font-label-caps uppercase tracking-wider text-[10px]">{k.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-lg text-headline-lg text-on-background">{loading ? '—' : k.value}</span>
              <span className="text-body-sm text-on-surface-variant text-xs">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Chart + Case Status + Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message Volume Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-outline-variant">
          <h3 className="font-title-sm text-on-background mb-1">Message Volume</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">{label} — inbound messages per day</p>
          <div className="h-48">
            {loading ? (
              <div className="flex items-center justify-center h-full text-on-surface-variant">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val) => [`${val} messages`, 'Inbound']}
                  />
                  <Bar dataKey="count" fill="#0058be" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Case Status Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant">
          <h3 className="font-title-sm text-on-background mb-1">Case Status</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">Distribution of all cases</p>
          <div className="space-y-3">
            {[
              { label: 'Open', count: openCases, pct: openPct, bar: 'bg-amber-400' },
              { label: 'In Progress', count: inProgress, pct: ipPct, bar: 'bg-blue-500' },
              { label: 'Resolved', count: resolved, pct: resPct, bar: 'bg-green-500' },
              { label: 'Closed', count: closed, pct: clPct, bar: 'bg-slate-400' },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-body-sm">
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-on-surface-variant">{s.count} ({s.pct}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`${s.bar} h-full transition-all rounded-full`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Attribution + Conversation Dynamics + Message Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Case Entry Attribution */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant">
          <h3 className="font-title-sm text-on-background mb-1">Case Entry Attribution</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">AI vs Manual creation</p>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" fill="transparent" r="54" stroke="#e2e8f0" strokeWidth="8" />
                <circle cx="64" cy="64" fill="transparent" r="54" stroke="#0058be" strokeDasharray="339" strokeDashoffset={339 - (339 * aiPct) / 100} strokeLinecap="round" strokeWidth="8" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-headline-md text-headline-md">{loading ? '—' : `${aiPct}%`}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">AI</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-body-sm"><div className="w-2.5 h-2.5 rounded-full bg-secondary" /> AI Created</span>
                <span className="font-semibold text-body-sm">{loading ? '—' : ai}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-body-sm"><div className="w-2.5 h-2.5 rounded-full bg-outline-variant" /> Manual</span>
                <span className="font-semibold text-body-sm">{loading ? '—' : manual}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Dynamics */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant">
          <h3 className="font-title-sm text-on-background mb-1">Conversation Dynamics</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">{label}</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-xl">chat</span>
              <div>
                <p className="text-on-surface-variant text-xs font-label-caps uppercase">Messages Received</p>
                <p className="font-headline-md text-headline-md">{loading ? '—' : msgsIn.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-xl">smart_toy</span>
              <div>
                <p className="text-on-surface-variant text-xs font-label-caps uppercase">AI Messages</p>
                <p className="font-headline-md text-headline-md">{loading ? '—' : msgsAi.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-600 text-xl">person</span>
              <div>
                <p className="text-on-surface-variant text-xs font-label-caps uppercase">Human Messages</p>
                <p className="font-headline-md text-headline-md">{loading ? '—' : msgsHuman.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-outline-variant">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant text-xs font-label-caps uppercase">AI Response Ratio</span>
                <span className="font-headline-md text-headline-md">{loading ? '—' : `${responseRatio}%`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Conversations */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant">
          <h3 className="font-title-sm text-on-background mb-1">Message Breakdown</h3>
          <p className="text-body-sm text-on-surface-variant mb-3">By direction and sender</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">call_received</span>
                <span className="text-body-sm font-semibold">Inbound</span>
              </div>
              <span className="font-headline-sm text-headline-sm">{loading ? '—' : msgsIn.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600 text-lg">smart_toy</span>
                <span className="text-body-sm font-semibold">AI Outbound</span>
              </div>
              <span className="font-headline-sm text-headline-sm">{loading ? '—' : msgsAi.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-lg">person</span>
                <span className="text-body-sm font-semibold">Agent Outbound</span>
              </div>
              <span className="font-headline-sm text-headline-sm">{loading ? '—' : msgsHuman.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-body-sm text-on-surface-variant opacity-50">
        <p>Last sync: just now</p>
      </div>
    </div>
  );
}
