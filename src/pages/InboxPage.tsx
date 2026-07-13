import { useParams, useNavigate } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import { useConversations } from '../hooks/useConversations';
import { supabase } from '../lib/supabase';
import ConversationList from '../components/ConversationList';
import ConversationThread from '../components/ConversationThread';
import SidePanel from '../components/SidePanel';

export default function InboxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();

  const { conversations, loading, loadingMore, hasMore, refetch, loadMore } = useConversations(business?.id || '');
  const selected = conversations.find(c => c.id === id) || null;

  const handleSelect = (cid: string) => {
    navigate(`/dashboard/conversations/${cid}`);
    supabase.from('conversations').update({ unread_count: 0 }).eq('id', cid).then(() => {});
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ConversationList conversations={conversations} selectedId={id || null} onSelect={handleSelect} onLoadMore={loadMore} loadingMore={loadingMore} hasMore={hasMore} loading={loading} />
      {selected ? (
        <>
          <ConversationThread key={selected.id} conversation={selected} onUpdate={refetch} />
          <SidePanel key={`panel-${selected.id}`} conversation={selected} onUpdate={refetch} />
        </>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-surface min-w-0">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-[28px]">messaging</span>
            </div>
            <p className="text-title-sm text-on-surface font-medium">Select a conversation</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Choose from the list on the left</p>
          </div>
        </div>
      )}
    </div>
  );
}
