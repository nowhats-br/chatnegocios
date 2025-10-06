import { useState, useCallback } from 'react';
import { useApiSettings } from '@/contexts/ApiSettingsContext';
import { toast } from 'sonner';

interface UseEvolutionApiReturn {
  data: unknown | null;
  error: string | null;
  loading: boolean;
  request: <T>(endpoint: string, options?: RequestInit) => Promise<T | null>;
}

interface EvolutionApiError {
  message: string;
  error?: string;
  statusCode?: number;
}

export function useEvolutionApi(): UseEvolutionApiReturn {
  const [data, setData] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const { apiUrl, apiKey } = useApiSettings();
  const evolutionApiUrl = apiUrl || import.meta.env.VITE_EVOLUTION_API_URL;
  const evolutionApiKey = apiKey || import.meta.env.VITE_EVOLUTION_API_KEY;

  const request = useCallback(async <T>(endpoint: string, options: RequestInit = {}): Promise<T | null> => {
    setLoading(true);
    setError(null);
    setData(null);

    if (!evolutionApiUrl || !evolutionApiKey) {
      const errorMessage = "Configurações da Evolution API não encontradas. Verifique se estão salvas nas Configurações (perfil) ou definidas via .env (VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY).";
      toast.error("Erro de Configuração", { description: errorMessage });
      setError(errorMessage);
      setLoading(false);
      return null;
    }

    try {
      const fullUrl = `${evolutionApiUrl}${endpoint}`;
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorData: EvolutionApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = { 
            message: `Erro HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status 
          };
        }
        const method = (options.method || 'GET').toString();
        const detailedMessage = `${errorData.message || `Erro na requisição: ${response.status}`}`+
          ` | URL: ${fullUrl} | Método: ${method}`;
        throw new Error(detailedMessage);
      }

      const responseData: T = await response.json();
      setData(responseData);
      setLoading(false);
      return responseData;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro desconhecido na Evolution API';
      setError(errorMessage);
      toast.error('Erro na Evolution API', { description: errorMessage });
      setLoading(false);
      return null;
    }
  }, [evolutionApiUrl, evolutionApiKey]);

  return { data, error, loading, request };
}