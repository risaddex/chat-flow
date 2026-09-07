import { useRef, useState } from 'react';
import { useSendMessage } from '../hooks/useSendMessage';
import { uploadMedia, mediaTypeFromMime } from '../lib/api';
import { useToast } from '../context/ToastContext';
import Spinner from './Spinner';

interface Props {
  conversationId: string;
  /** True when a human has taken over (a case is open) and can send messages. */
  canReply: boolean;
  onTakeOver: () => void;
  takingOver?: boolean;
  customerName?: string;
}

export default function ReplyBar({ conversationId, canReply, onTakeOver, takingOver, customerName }: Props) {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { send, sending } = useSendMessage(conversationId);

  const busy = sending || uploading;

  const handleSend = async () => {
    if (busy || !canReply) return;
    if (!file && !text.trim()) return;
    const caption = text.trim();
    const attachment = file;
    setText('');
    setFile(null);
    try {
      if (attachment) {
        setUploading(true);
        let media;
        try { media = await uploadMedia(attachment); } finally { setUploading(false); }
        await send({
          content: caption,
          message_type: mediaTypeFromMime(attachment.type || ''),
          media_path: media.media_path,
          mime_type: media.mime_type,
          filename: attachment.name,
        });
      } else {
        await send({ content: caption });
      }
    } catch (e) {
      showToast('Failed to send: ' + ((e as Error).message || 'Unknown'));
      setText(caption);
      setFile(attachment);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // AI is handling this conversation — the human must take over (which opens a
  // case) before they can reply. Show an explicit button, not a text field.
  if (!canReply) {
    return (
      <footer className="p-4 bg-white border-t border-outline-variant">
        <button
          onClick={onTakeOver}
          disabled={takingOver}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-2xl font-title-sm hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {takingOver
            ? <Spinner size="sm" color="border-white" />
            : <span className="material-symbols-outlined text-[20px]">support_agent</span>}
          {takingOver ? 'Taking over…' : 'Take over to reply'}
        </button>
        <p className="text-center text-[11px] text-on-surface-variant mt-2">
          AI is handling this chat. Take over to send a message.
        </p>
      </footer>
    );
  }

  return (
    <footer className="p-4 bg-white border-t border-outline-variant">
      {file && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-surface-container-low rounded-xl text-body-sm">
          <span className="material-symbols-outlined text-[18px] text-secondary">
            {mediaTypeFromMime(file.type || '') === 'image' ? 'image' : 'attach_file'}
          </span>
          <span className="truncate flex-1 text-on-surface">{file.name}</span>
          <button onClick={() => setFile(null)} aria-label="Remove attachment" className="p-1 text-on-surface-variant hover:text-red-600">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-2xl p-2 focus-within:ring-2 focus-within:ring-secondary/20 transition-all">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ''; }}
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label="Attach file"
          className="p-2 text-outline-variant hover:text-secondary transition-colors disabled:opacity-40">
          <span className="material-symbols-outlined">add_circle</span>
        </button>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={file ? 'Add a caption (optional)…' : `Type a message as ${customerName || 'agent'}...`}
          autoFocus
          className="flex-1 bg-transparent border-none focus:ring-0 text-body-md outline-none"
        />
        <div className="flex items-center gap-1">
          <button aria-label="Emoji" className="p-2 text-outline-variant hover:text-secondary transition-colors">
            <span className="material-symbols-outlined">sentiment_satisfied</span>
          </button>
          <button onClick={handleSend} disabled={busy || (!file && !text.trim())} aria-label="Send message"
            className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {busy ? <Spinner size="sm" color="border-white" />
              : <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>}
          </button>
        </div>
      </div>
    </footer>
  );
}
