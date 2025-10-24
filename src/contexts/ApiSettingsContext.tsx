import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
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

  const envApiUrl = (import.meta.env.VITE_EVOLUTION_API_URL as string) || null;
  const envApiKey = (import.meta.env.VITE_EVOLUTION_API_KEY as string) || null;
  const envUseProxy = String(import.meta.env.VITE_EVOLUTION_USE_PROXY || 'true') === 'true';
  const backendBase = (() => {
    const url = (import.meta.env.VITE_BACKEND_URL as string) || window.location.origin;
    return url.endsWith('/') ? url.slice(0, -1) : url;
  })();

  const normalizeUrl = (url: string | null) => {
    if (!url) return null;
    return url.endsWith('/') ? url.slice(0, -1) : url;
  };

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      const proxyBase = `${backendBase}/api/evolution`;
      const directUrl = normalizeUrl(envApiUrl) || null;
      setApiUrl(envUseProxy ? proxyBase : directUrl);
      setApiKey(envUseProxy ? null : (envApiKey || null));
      return;
    }
    
    setLoading(true);
    try {
      await dbClient.profiles.ensureExists();
      const data = await dbClient.profiles.get(user.id);
      
      const directUrl = normalizeUrl(data.evolution_api_url || envApiUrl || null);
      const proxyBase = `${backendBase}/api/evolution`;
      const effectiveUrl = envUseProxy ? proxyBase : directUrl;
      const effectiveKey = envUseProxy ? null : (data.evolution_api_key || envApiKey || null);

      setApiUrl(effectiveUrl);
      setApiKey(effectiveKey);

    } catch (error: any) {
      toast.error("Erro ao carregar configurações da API", { description: error.message });
      const proxyBase = `${backendBase}/api/evolution`;
      const directUrl = normalizeUrl(envApiUrl) || null;
      setApiUrl(envUseProxy ? proxyBase : directUrl);
      setApiKey(envUseProxy ? null : (envApiKey || null));
    } finally {
      setLoading(false);
    }
  }, [user, envApiUrl, envApiKey, envUseProxy, backendBase]);


  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newApiUrl: string, newApiKey: string) => {
    if (!user) {
      toast.error("Você precisa estar logado para salvar as configurações.");
      return;
    }
    try {
      await dbClient.profiles.update(user.id, newApiUrl, newApiKey);
      setApiUrl(normalizeUrl(newApiUrl));
      setApiKey(newApiKey);
      toast.success("Configurações da API salvas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar configurações", { description: error.message });
      throw error;
    }
  };

  const isConfigured = !!apiUrl && (envUseProxy || !!apiKey);

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
