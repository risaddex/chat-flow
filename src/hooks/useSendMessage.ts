import { useState } from 'react';
import { sendOutbound } from '../lib/api';

interface SendParams {
  content: string;
  message_type?: string;
  media_path?: string;
  mime_type?: string;
  filename?: string;
}

export function useSendMessage(conversationId: string) {
  const [sending, setSending] = useState(false);

  const send = async (params: SendParams) => {
    setSending(true);
    try {
      await sendOutbound({ conversation_id: conversationId, ...params });
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}
