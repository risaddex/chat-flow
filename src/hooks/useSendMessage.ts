import { useState } from 'react';
import { sendOutbound } from '../lib/api';

interface SendParams {
  content: string;
  message_type?: string;
  media_url?: string;
  mime_type?: string;
  filename?: string;
}

export function useSendMessage(phone: string) {
  const [sending, setSending] = useState(false);

  const send = async (params: SendParams) => {
    setSending(true);
    try {
      await sendOutbound({ phone, ...params });
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}
