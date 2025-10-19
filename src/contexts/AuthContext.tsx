import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbClient } from '@/lib/dbClient';

interface AuthContextType {
  user: { id: string; email: string } | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { user } = await dbClient.auth.me();
        if (!mounted) return;
        setUser(user ?? null);
      } catch (_e) {
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const logout = async () => {
    try {
      await dbClient.auth.logout();
    } catch (_) {
      // swallow errors; ensure local state is cleared
    }
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch (_) {}
    setUser(null);
    setLoading(false);
  };
  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};