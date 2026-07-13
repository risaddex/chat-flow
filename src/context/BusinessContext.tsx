import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { Business } from '../types';

interface BusinessState {
  business: Business | null;
  loading: boolean;
}

const BusinessContext = createContext<BusinessState>({ business: null, loading: true });

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setBusiness(null); setLoading(false); return; }
    setLoading(true);
    supabase.from('businesses').select('id, name, whatsapp_phone_number_id, ai_config, created_at').limit(1).single().then(({ data }) => {
      setBusiness(data as Business | null);
      setLoading(false);
    });
  }, [user]);

  return (
    <BusinessContext.Provider value={{ business, loading }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
