import React, { createContext, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LocalUser {
  id: number;
  email: string;
  role?: string;
}

interface AuthContextType {
  user: LocalUser | null;
}

const AuthContext = createContext<AuthContextType>({ user: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.id !== 'undefined' && parsed.email) {
          setUser(parsed);
        } else {
          localStorage.removeItem('auth_user');
        }
      }
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
