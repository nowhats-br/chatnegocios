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
  const envApiUrl = import.meta.env.VITE_EVOLUTION_API_URL as string | undefined;
  const envApiKey = import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined;
  const [apiUrl, setApiUrl] = useState<string | null>(envApiUrl || null);
  const [apiKey, setApiKey] = useState<string | null>(envApiKey || null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      // Fallback localStorage/env mesmo sem usuário
      const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_url') : null;
      const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_key') : null;
      setApiUrl(localUrl || envApiUrl || null);
      setApiKey(localKey || envApiKey || null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await dbClient.profiles.get(user.id);
      // Fallback: se backend não tem perfil, usar localStorage, depois .env
      const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_url') : null;
      const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_key') : null;
      setApiUrl(data.evolution_api_url || localUrl || envApiUrl || null);
      setApiKey(data.evolution_api_key || localKey || envApiKey || null);
    } catch (error: any) {
      // 404 sem perfil: usar localStorage/env
      const localUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_url') : null;
      const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('evolution_api_key') : null;
      setApiUrl(localUrl || envApiUrl || null);
      setApiKey(localKey || envApiKey || null);
    }
    setLoading(false);
  }, [user]);

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
      setApiUrl(newApiUrl);
      setApiKey(newApiKey);
      // Persistência local para evitar perda em reinícios do backend
      try {
        localStorage.setItem('evolution_api_url', newApiUrl);
        localStorage.setItem('evolution_api_key', newApiKey);
      } catch (_) {}
      toast.success("Configurações da API salvas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar configurações", { description: error.message });
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
