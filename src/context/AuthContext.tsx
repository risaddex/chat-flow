import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const ADMIN_EMAIL = import.meta.env.VITE_LOGIN_EMAIL || 'admin@admin.com';
const ADMIN_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || 'admin123';

interface StoredSession {
  email: string;
  name: string;
  loggedInAt: string;
}

interface AuthState {
  session: StoredSession | null;
  user: { email: string; user_metadata: { name: string } } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('session');
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch { localStorage.removeItem('session'); }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      throw new Error('Invalid email or password');
    }
    const sess: StoredSession = { email, name: 'Admin', loggedInAt: new Date().toISOString() };
    localStorage.setItem('session', JSON.stringify(sess));
    setSession(sess);
  };

  const signOut = async () => {
    localStorage.removeItem('session');
    setSession(null);
  };

  const user = session ? { email: session.email, user_metadata: { name: session.name } } : null;

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
