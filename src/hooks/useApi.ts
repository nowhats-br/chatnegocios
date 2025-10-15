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

    if (!isConfigured || !apiUrl || !apiKey) {
      const errorMessage = 'Configurações da API não encontradas. Por favor, configure a URL e a Chave de API na página de Configurações.';
      toast.error('Erro de Configuração', { description: errorMessage });
      setError(errorMessage);
      setLoading(false);
      return null;
    }

    try {
      const fullUrl = `${apiUrl}${endpoint}`;

      const controller = new AbortController();
      const timeoutMs = 20000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const isGet = !options.method || options.method.toString().toUpperCase() === 'GET';
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...(!isGet ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      };
      if (/^Bearer\s+/i.test(String(apiKey))) {
        (headers as any)['Authorization'] = String(apiKey);
      } else {
        (headers as any)['apikey'] = String(apiKey);
      }

      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let message = `O servidor respondeu com status ${response.status}`;
        if (contentType.includes('application/json')) {
          try {
            const errorData: any = await response.json();
            message = errorData?.message || message;
          } catch { /* ignore */ }
        } else {
          const text = await response.text().catch(() => '');
          if (text && /taking longer than expected to load/i.test(text)) {
            message = 'O serviço Evolution API está iniciando/indisponível. Tente novamente em alguns minutos.';
          } else if (text) {
            message = `Resposta não-JSON (${response.status}): ${text.slice(0, 160)}...`;
          }
        }
        throw new Error(`${message} | URL: ${fullUrl}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        const msg = text && /taking longer than expected to load/i.test(text)
          ? 'O serviço Evolution API está iniciando/indisponível. Tente novamente em alguns minutos.'
          : `Resposta não-JSON inesperada | URL: ${fullUrl} | Conteúdo: ${text.slice(0, 160)}...`;
        throw new Error(msg);
      }

      const responseData: T = await response.json();
      setData(responseData);
      setLoading(false);
      return responseData;
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido na API';
      setError(msg);
      toast.error('Erro na API', { description: msg });
      setLoading(false);
      return null;
    }
  }, [apiUrl, apiKey, isConfigured]);

  return { data, error, loading, request };
}
