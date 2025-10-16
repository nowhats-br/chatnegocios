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
  const defaultTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000;

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: apiKey || '',
          ...options.headers,
        },
        signal: options.signal || controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let serverMessage = `O servidor respondeu com status ${response.status}`;
        if (contentType.includes('application/json')) {
          const errorJson = await response.json().catch(() => null);
          if (errorJson && (errorJson.message || errorJson.error)) {
            serverMessage = errorJson.message || errorJson.error;
          }
        } else {
          const errorText = await response.text().catch(() => '');
          if (errorText) serverMessage = errorText;
        }
        throw new Error(serverMessage);
      }

      let responseData: T | null = null;
      if (contentType.includes('application/json')) {
        responseData = (await response.json()) as T;
      } else {
        // Fallback para respostas não-JSON (registrar texto e retornar null)
        const text = await response.text().catch(() => '');
        if (text) {
          // Anexar texto bruto ao erro para diagnóstico em chamadas subsequentes
          toast.info('Resposta não-JSON recebida da API', { description: text.slice(0, 200) });
        }
        responseData = null;
      }

      setData(responseData);
      setLoading(false);
      return responseData;
    } catch (err: any) {
      const message = err?.name === 'AbortError'
        ? `Tempo limite excedido (${defaultTimeoutMs}ms) para ${endpoint}`
        : err?.message || 'Erro desconhecido na requisição.';
      setError(message);
      toast.error('Erro na API', { description: message });
      setLoading(false);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }, [apiUrl, apiKey, isConfigured, defaultTimeoutMs]);

  return { data, error, loading, request };
}
