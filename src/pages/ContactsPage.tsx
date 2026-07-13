import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { supabase } from '../lib/supabase';
import { useDebounce } from '../hooks/useDebounce';
import { createContact, updateContact, createManualCase } from '../lib/api';
import { getAvatarColor, getInitials } from '../lib/avatar';
import { fmtTime, fmtCaseDate } from '../lib/format';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import Spinner from '../components/Spinner';
import type { Contact, Case } from '../types';

interface ContactWithCases extends Contact {
  cases?: Case[];
  openCase?: Case | null;
}

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-amber-100 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    closed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${styles[status] || styles.open}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function NewContactModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [waId, setWaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSave = async () => {
    if (!waId.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createContact({ wa_id: waId.trim(), name: name.trim(), title: title.trim() });
    } catch (e) {
      setError((e as Error).message || 'Failed to create contact. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setName(''); setTitle(''); setWaId('');
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant">
          <h2 className="font-headline-md text-headline-md text-primary">New Contact</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Add a new contact to your directory</p>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-body-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">WhatsApp Number *</label>
            <input type="text" value={waId} onChange={e => setWaId(e.target.value)} placeholder="923001234567"
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Title <span className="text-outline-variant normal-case">(optional)</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CEO, Manager"
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none" />
          </div>
        </div>
        <div className="p-6 border-t border-outline-variant flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-body-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !waId.trim()}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-body-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Creating...' : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditContactModal({ open, contact, onClose, onSaved }: { open: boolean; contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) { setName(contact.name || ''); setTitle(contact.title || ''); }
  }, [contact]);

  if (!open || !contact) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContact({ id: contact.id, name: name.trim(), title: title.trim() });
      onSaved();
      onClose();
    } catch (e) {
      showToast('Failed to update contact: ' + ((e as Error).message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant">
          <h2 className="font-headline-md text-headline-md text-primary">Edit Contact</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Update contact details</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">WhatsApp Number</label>
            <input type="text" value={contact.wa_id} disabled
              className="w-full px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-xl text-body-md text-on-surface-variant cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Title <span className="text-outline-variant normal-case">(optional)</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CEO, Manager"
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none" />
          </div>
        </div>
        <div className="p-6 border-t border-outline-variant flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-body-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-body-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCaseModal({ open, contact, existingOpenCase, onClose, onCreated }: {
  open: boolean;
  contact: Contact | null;
  existingOpenCase: Case | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && existingOpenCase) {
      setError(`This contact already has an open case: "${existingOpenCase.subject}"`);
    } else {
      setError('');
    }
  }, [open, existingOpenCase]);

  if (!open || !contact) return null;

  const handleSave = async () => {
    if (!subject.trim()) return;
    if (existingOpenCase) {
      setError(`Cannot create a new case. There is already an open case: "${existingOpenCase.subject}"`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createManualCase({
        phone: contact.wa_id,
        customer_name: contact.name || undefined,
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });
      setSubject(''); setDescription(''); setPriority('medium');
      onCreated();
      onClose();
    } catch (e) {
      console.error('Failed to create case:', e);
      setError((e as Error).message || 'An unexpected error occurred. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant">
          <h2 className="font-headline-md text-headline-md text-primary">Create Case</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">Open a new case for {contact.name || contact.wa_id}</p>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-body-sm text-amber-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">WhatsApp Number</label>
              <input type="text" value={contact.wa_id} disabled
                className="w-full px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-xl text-body-md text-on-surface-variant cursor-not-allowed" />
            </div>
            <div className="w-32">
              <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Source</label>
              <input type="text" value="Manual" disabled
                className="w-full px-4 py-2.5 bg-surface-container-high border border-outline-variant rounded-xl text-body-md text-on-surface-variant cursor-not-allowed text-center" />
            </div>
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Title *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue"
              disabled={!!existingOpenCase}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Summary</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed description..." rows={3}
              disabled={!!existingOpenCase}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none resize-none disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-2">Urgency</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} disabled={!!existingOpenCase}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all disabled:opacity-50 ${
                    priority === p
                      ? p === 'urgent' ? 'bg-error-container text-on-error-container border-red-200'
                        : p === 'high' ? 'bg-red-50 text-red-700 border-red-200'
                        : p === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-outline-variant flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-body-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">
            {existingOpenCase ? 'Close' : 'Cancel'}
          </button>
          {!existingOpenCase && (
            <button onClick={handleSave} disabled={saving || !subject.trim()}
              className="px-6 py-2 bg-primary text-on-primary rounded-xl text-body-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
              {saving ? 'Creating...' : 'Create Case'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const { business } = useBusiness();
  const [contacts, setContacts] = useState<ContactWithCases[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sel, setSel] = useState<ContactWithCases | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [showAllCases, setShowAllCases] = useState(false);
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchContacts = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });
    if (debouncedSearch) query = query.or(`name.ilike.%${debouncedSearch}%,wa_id.ilike.%${debouncedSearch}%,title.ilike.%${debouncedSearch}%`);
    const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) {
      console.error('Contacts fetch error:', error);
    }
    setContacts((data || []) as ContactWithCases[]);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [business?.id, debouncedSearch, page, refreshKey]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const fetchCasesForContact = useCallback(async (contact: Contact): Promise<{ openCase: Case | null; allCases: Case[] }> => {
    if (!business?.id) return { openCase: null, allCases: [] };
    const { data: convs } = await supabase.from('conversations').select('id').eq('business_id', business.id).eq('wa_id', contact.wa_id);
    if (!convs || convs.length === 0) return { openCase: null, allCases: [] };
    const convIds = convs.map(c => c.id);
    const { data: cases } = await supabase.from('cases').select('*').in('conversation_id', convIds).order('created_at', { ascending: false });
    const allCases = (cases || []) as Case[];
    const openCase = allCases.find(c => c.status === 'open' || c.status === 'in_progress') || null;
    return { openCase, allCases };
  }, [business?.id]);

  const handleSelect = async (contact: ContactWithCases) => {
    setShowAllCases(false);
    const { openCase, allCases } = await fetchCasesForContact(contact);
    setSel({ ...contact, openCase, cases: allCases });
  };

  const handleChatClick = async () => {
    if (!sel || !business?.id) return;
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('business_id', business.id)
      .eq('wa_id', sel.wa_id)
      .limit(1)
      .maybeSingle();
    if (conv) navigate(`/dashboard/conversations/${conv.id}`);
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    if (sel) handleSelect(sel);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Contact List */}
      <section className="flex-1 bg-white flex flex-col h-full border-r border-outline-variant min-w-0">
        <header className="p-gutter border-b border-outline-variant">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display-lg text-display-lg text-primary">Contacts</h1>
            <button onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-title-sm hover:opacity-90 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              New Contact
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
            <input type="text" placeholder="Search by name, WhatsApp number or title..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); setSel(null); }}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none text-body-md" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[420px]">
            <thead className="sticky top-0 bg-surface-container-low z-10">
              <tr>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Contact</th>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">WhatsApp Number</th>
                <th className="px-gutter py-3 text-label-caps text-on-surface-variant font-bold uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={3} className="px-gutter py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={3} className="px-gutter py-16 text-center text-body-sm text-on-surface-variant">{search ? 'No contacts found' : 'No contacts yet'}</td></tr>
              ) : contacts.map(c => {
                const initials = getInitials(c.name, c.wa_id);
                const isSelected = sel?.id === c.id;
                return (
                  <tr key={c.id} onClick={() => handleSelect(c)}
                    className={`hover:bg-surface-container-lowest cursor-pointer transition-colors group ${isSelected ? 'bg-surface-container-low' : ''}`}
                    style={isSelected ? { borderLeft: '4px solid #0058be' } : { borderLeft: '4px solid transparent' }}>
                    <td className="px-gutter py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ backgroundColor: getAvatarColor(c.wa_id) }}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-title-sm text-primary truncate">{c.name || c.wa_id}</div>
                          {c.title && <div className="text-body-sm text-on-surface-variant">{c.title}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-gutter py-4 text-body-md text-on-surface-variant">{c.wa_id}</td>
                    <td className="px-gutter py-4 text-body-sm text-on-surface-variant">{fmtTime(c.last_message_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} currentCount={contacts.length} label="contacts" onPageChange={p => setPage(p)} />
      </section>

      {/* Contact Profile Sidebar — overlay on mobile, static column on desktop */}
      {sel ? (
        <aside className="fixed inset-0 z-50 bg-white flex flex-col h-full overflow-y-auto lg:static lg:z-auto lg:w-[350px] lg:min-w-[350px] lg:max-w-[350px] lg:shrink-0 lg:border-l lg:border-outline-variant">
          {/* Mobile back bar */}
          <div className="lg:hidden flex items-center gap-2 h-14 px-4 border-b border-outline-variant shrink-0">
            <button onClick={() => setSel(null)} aria-label="Back to contacts" className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="font-title-sm text-on-surface font-semibold">Contact</span>
          </div>
          {/* Profile Header */}
          <div className="p-gutter flex flex-col items-center text-center border-b border-outline-variant bg-surface-container-low/20">
            <div className="w-16 h-16 rounded-full border-2 border-white shadow-md overflow-hidden mb-4 flex items-center justify-center text-headline-md font-bold text-white"
              style={{ backgroundColor: getAvatarColor(sel.wa_id) }}>
              {getInitials(sel.name, sel.wa_id)}
            </div>
            <h2 className="font-headline-md text-headline-md text-primary">{sel.name || 'Unknown'}</h2>
            {sel.title && <p className="text-body-sm text-on-surface-variant mt-0.5">{sel.title}</p>}
            <p className="text-body-md text-secondary font-medium mt-1">{sel.wa_id}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleChatClick} className="p-2.5 bg-surface-container rounded-full text-secondary hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">chat</span>
              </button>
            </div>
          </div>

          {/* Open Case Banner */}
          {sel.openCase && (
            <div className="p-gutter border-b border-outline-variant bg-amber-50/80">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                <h3 className="text-label-caps text-amber-800 font-bold uppercase tracking-widest text-xs">Open Case</h3>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <StatusBadge status={sel.openCase.status} />
                  <span className="text-[11px] text-on-surface-variant">{fmtCaseDate(sel.openCase.created_at)}</span>
                </div>
                <div className="text-body-sm font-semibold text-primary mt-1.5">{sel.openCase.subject}</div>
                {sel.openCase.description && (
                  <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">{sel.openCase.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="p-gutter border-b border-outline-variant">
            <h3 className="text-label-caps text-on-surface-variant font-bold uppercase tracking-widest mb-4">Contact Info</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-outline text-[20px]">phone_iphone</span>
                <div>
                  <div className="text-xs text-on-surface-variant">WhatsApp Number</div>
                  <div className="text-body-md text-on-surface">{sel.wa_id}</div>
                </div>
              </div>
              {sel.title && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-outline text-[20px]">badge</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Title</div>
                    <div className="text-body-md text-on-surface">{sel.title}</div>
                  </div>
                </div>
              )}
              {sel.email && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-outline text-[20px]">mail</span>
                  <div>
                    <div className="text-xs text-on-surface-variant">Email</div>
                    <div className="text-body-md text-on-surface">{sel.email}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Case History */}
          <div className="p-gutter border-b border-outline-variant flex-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-label-caps text-on-surface-variant font-bold uppercase tracking-widest">Case History</h3>
            </div>
            <div className="space-y-3">
              {!sel.cases || sel.cases.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">No cases yet</p>
              ) : (
                <>
                  {(showAllCases ? sel.cases : sel.cases.slice(0, 3)).map(c => (
                    <div key={c.id} className="p-3 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer">
                      <div className="flex justify-between items-start mb-1">
                        <StatusBadge status={c.status} />
                        <span className="text-[11px] text-on-surface-variant">{fmtCaseDate(c.created_at)}</span>
                      </div>
                      <div className="text-body-sm font-semibold text-primary mt-1">#{c.id.slice(0, 8).toUpperCase()} - {c.subject}</div>
                    </div>
                  ))}
                  {sel.cases.length > 3 && (
                    <button onClick={() => setShowAllCases(!showAllCases)}
                      className="w-full text-center text-body-sm text-secondary font-semibold py-2 hover:bg-surface-container-low rounded-xl transition-colors">
                      {showAllCases ? 'Show Less' : `View All (${sel.cases.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-gutter mt-auto space-y-3">
            <button onClick={() => setShowEdit(true)}
              className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-title-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">edit</span>
              Edit Contact
            </button>
            {sel.openCase ? (
              <button onClick={() => navigate(`/dashboard/cases`)}
                className="w-full py-3 bg-amber-100 text-amber-800 rounded-xl font-title-sm hover:bg-amber-200 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                View Open Case
              </button>
            ) : (
              <button onClick={() => setShowCreateCase(true)}
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-title-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Create Case
              </button>
            )}
          </div>
        </aside>
      ) : (
        <aside className="hidden lg:flex w-[350px] min-w-[350px] max-w-[350px] bg-white flex-col h-full items-center justify-center shrink-0 border-l border-outline-variant">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[28px]">person</span>
            </div>
            <p className="text-title-sm text-on-surface font-medium">Select a contact</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">View details from the list</p>
          </div>
        </aside>
      )}

      <NewContactModal open={showNew} onClose={() => setShowNew(false)} onCreated={handleRefresh} />
      <EditContactModal open={showEdit} contact={sel} onClose={() => setShowEdit(false)} onSaved={handleRefresh} />
      <CreateCaseModal open={showCreateCase} contact={sel} existingOpenCase={sel?.openCase || null} onClose={() => setShowCreateCase(false)} onCreated={handleRefresh} />
    </div>
  );
}
