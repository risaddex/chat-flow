import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NavigateListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.conversationId) {
        navigate(`/dashboard/conversations/${detail.conversationId}`);
      }
    };
    window.addEventListener('navigate-conversation', handler);
    return () => window.removeEventListener('navigate-conversation', handler);
  }, [navigate]);

  return null;
}
