import { useEffect, useState } from 'react';
import type { Message } from '../types';
import { getMediaUrl } from '../lib/api';

interface Props {
  message: Message;
}

// Content shared by every bubble variant: renders media (image/video/audio/
// document) from media_url when present, otherwise the text content. The
// n8n pipeline stores a "[<type> message]" placeholder as content when a
// media message has no caption — suppress that so we don't show it under media.
function MessageBody({ message }: { message: Message }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!message.media_path) { setUrl(''); return; }
    let current = true;
    getMediaUrl(message.id).then((value) => { if (current) setUrl(value); }).catch(() => { if (current) setUrl(''); });
    return () => { current = false; };
  }, [message.id, message.media_path]);
  const type = message.type;
  const isPlaceholder = /^\[[a-z]+ message\]$/i.test((message.content || '').trim());
  const caption = isPlaceholder ? '' : (message.content || '');

  const captionEl = caption ? (
    <p className="text-body-sm leading-relaxed whitespace-pre-wrap break-words mt-2">{caption}</p>
  ) : null;

  if (url && (type === 'image' || type === 'sticker')) {
    return (
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt={caption || 'Image'} loading="lazy"
            className="rounded-xl max-h-72 w-auto max-w-full object-cover" />
        </a>
        {captionEl}
      </div>
    );
  }

  if (url && type === 'video') {
    return (
      <div>
        <video controls src={url} preload="metadata" className="rounded-xl max-h-72 max-w-full">
          <track kind="captions" />
        </video>
        {captionEl}
      </div>
    );
  }

  if (url && (type === 'audio' || type === 'voice')) {
    return (
      <div>
        <audio controls src={url} className="w-full h-8 min-w-[220px]" preload="metadata">
          <track kind="captions" />
        </audio>
        {captionEl}
      </div>
    );
  }

  if (url && type === 'document') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 underline decoration-1 underline-offset-2">
        <span className="material-symbols-outlined text-[20px]">description</span>
        <span className="text-body-md break-all">{caption || 'Document'}</span>
      </a>
    );
  }

  return <p className="text-body-md leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>;
}

export default function MessageBubble({ message }: Props) {
  const isInbound = message.direction === 'inbound';
  const isAi = message.sent_by === 'ai';
  const isHuman = message.sent_by === 'human';
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const reactions = (message.metadata as any)?.reactions as { emoji: string }[] | undefined;
  const reaction = reactions && reactions.length > 0 ? reactions[0] : null;

  if (isHuman && !isInbound) {
    return (
      <div className="flex flex-col items-end w-full">
        <div className="max-w-[80%] bg-primary-container text-on-primary px-4 py-3 rounded-2xl rounded-tr-none shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-[14px] text-on-primary-container">person</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-primary-container">
              {message.agent_name || 'Agent'} - Human Agent
            </span>
          </div>
          <MessageBody message={message} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-on-surface-variant font-medium">{time}</span>
          {message.status === 'read' && <span className="material-symbols-outlined text-secondary text-[14px]">done_all</span>}
          {message.status === 'delivered' && <span className="material-symbols-outlined text-outline text-[14px]">done_all</span>}
          {message.status === 'sent' && <span className="material-symbols-outlined text-outline text-[14px]">done</span>}
          {reaction && (
            <span className="bg-white border border-outline-variant rounded-full px-1.5 py-0.5 shadow-sm text-[12px] cursor-pointer hover:scale-110 transition-transform">
              {reaction.emoji}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isAi && !isInbound) {
    return (
      <div className="flex flex-col items-end w-full">
        <div className="max-w-[80%] ai-bubble-gradient border border-emerald-100 px-4 py-3 rounded-2xl rounded-tr-none shadow-sm text-emerald-900">
          <div className="flex items-center gap-1 mb-1">
            <span className="material-symbols-outlined text-[14px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">AI</span>
          </div>
          <MessageBody message={message} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          {message.status === 'read' && <span className="material-symbols-outlined text-emerald-500 text-[14px]">done_all</span>}
          {message.status === 'delivered' && <span className="material-symbols-outlined text-outline text-[14px]">done_all</span>}
          {message.status === 'sent' && <span className="material-symbols-outlined text-outline text-[14px]">done</span>}
          <span className="text-[11px] text-on-surface-variant font-medium">{time}</span>
          {reaction && (
            <span className="bg-white border border-outline-variant rounded-full px-1.5 py-0.5 shadow-sm text-[12px] cursor-pointer hover:scale-110 transition-transform">
              {reaction.emoji}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start max-w-[80%]">
      <div className="bg-white border border-outline-variant px-4 py-3 rounded-2xl rounded-tl-none shadow-sm text-on-surface">
        <MessageBody message={message} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-on-surface-variant font-medium">{time}</span>
        {message.status === 'read' && <span className="material-symbols-outlined text-secondary text-[14px]">done_all</span>}
        {message.status === 'delivered' && <span className="material-symbols-outlined text-outline text-[14px]">done_all</span>}
        {message.status === 'sent' && <span className="material-symbols-outlined text-outline text-[14px]">done</span>}
        {reaction && (
          <span className="bg-white border border-outline-variant rounded-full px-1.5 py-0.5 shadow-sm text-[12px] cursor-pointer hover:scale-110 transition-transform">
            {reaction.emoji}
          </span>
        )}
      </div>
    </div>
  );
}
