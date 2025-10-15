import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface ApiSettingsContextType {
  apiUrl: string | null;
  apiKey: string | null;
  isConfigured: boolean;
  loading: boolean;
  updateSettings: (apiUrl: string, apiKey: string) => Promise<void>;
}

const ApiSettingsContext = createContext<ApiSettingsContextType>({
  apiUrl: null,
  apiKey: null,
  isConfigured: false,
  loading: true,
  updateSettings: async () => {},
});

export const ApiSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const envUrl = import.meta.env.VITE_EVOLUTION_API_URL ?? null;
    const envKey = import.meta.env.VITE_EVOLUTION_API_KEY ?? null;
    if (!user) {
      setApiUrl(envUrl);
      setApiKey(envKey);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/${String(user.id)}`);
      if (res.status === 404) {
        // Sem configuração no backend: usar fallback do .env
        setApiUrl(envUrl);
        setApiKey(envKey);
      } else if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error('Erro ao buscar configurações da API', {
          description: `HTTP ${res.status} ${res.statusText}${text ? ` - ${text.substring(0, 300)}` : ''}`,
        });
        setApiUrl(envUrl);
        setApiKey(envKey);
      } else {
        const data = await res.json();
        setApiUrl(data?.evolution_api_url ?? envUrl);
        setApiKey(data?.evolution_api_key ?? envKey);
      }
    } catch (err) {
      toast.error('Erro ao buscar configurações da API', { description: String(err) });
      setApiUrl(envUrl);
      setApiKey(envKey);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newApiUrl: string, newApiKey: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para salvar as configurações.');
      return;
    }
    try {
      const res = await fetch(`/api/settings/${String(user.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evolution_api_url: newApiUrl, evolution_api_key: newApiKey }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error('Erro ao salvar configurações', {
          description: `HTTP ${res.status} ${res.statusText}${text ? ` - ${text.substring(0, 300)}` : ''}`,
        });
        return;
      }
      const data = await res.json().catch(() => ({}));
      setApiUrl(data?.evolution_api_url ?? newApiUrl);
      setApiKey(data?.evolution_api_key ?? newApiKey);
      toast.success('Configurações da API salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar configurações', { description: String(err) });
    }
  };

  const isConfigured = !!apiUrl && !!apiKey;

  return (
    <ApiSettingsContext.Provider value={{ apiUrl, apiKey, isConfigured, loading, updateSettings }}>
      {children}
    </ApiSettingsContext.Provider>
  );
};

export const useApiSettings = () => {
  const context = useContext(ApiSettingsContext);
  if (context === undefined) {
    throw new Error('useApiSettings must be used within an ApiSettingsProvider');
  }
  return context;
};
