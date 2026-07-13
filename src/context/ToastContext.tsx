import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

const AUTO_DISMISS_MS = 4000;

const TOAST_STYLE: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', icon: 'check_circle' },
  error: { bg: 'bg-red-600', icon: 'error' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => {
          const style = TOAST_STYLE[t.type];
          return (
            <div key={t.id}
              className={`${style.bg} text-white rounded-xl shadow-lg px-4 py-3 max-w-sm flex items-start gap-2 pointer-events-auto`}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">{style.icon}</span>
              <span className="text-[13px] leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
