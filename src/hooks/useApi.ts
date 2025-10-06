import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useApiSettings } from '@/contexts/ApiSettingsContext';

interface UseApiReturn<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  request: (endpoint: string, options?: RequestInit) => Promise<T | null>;
}

export function useApi<T>(): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { apiUrl, apiKey, isConfigured } = useApiSettings();

  const request = useCallback(async (endpoint: string, options: RequestInit = {}): Promise<T | null> => {
    setLoading(true);
    setError(null);
    setData(null);

    if (!isConfigured) {
      const errorMessage = "Configurações da API não encontradas. Por favor, configure a URL e a Chave de API na página de Configurações.";
      toast.error("Erro de Configuração", { description: errorMessage });
      setError(errorMessage);
      setLoading(false);
      return null;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'apikey': apiKey } : {}),
        ...(options.headers || {}),
      };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `O servidor respondeu com status ${response.status}` }));
        throw new Error(errorData.message || 'Ocorreu um erro na requisição.');
      }

      const responseData: T = await response.json();
      setData(responseData);
      setLoading(false);
      return responseData;
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro na API', { description: err.message });
      setLoading(false);
      return null;
    }
  }, [apiUrl, apiKey, isConfigured]);

  return { data, error, loading, request };
}
