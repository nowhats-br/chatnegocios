import { useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useApiSettings } from '@/contexts/ApiSettingsContext';

interface UseEvolutionApiReturn {
  data: any | null;
  error: string | null;
  loading: boolean;
  request: <R>(endpoint: string, options?: RequestInit) => Promise<R | null>;
}

export function useEvolutionApi(): UseEvolutionApiReturn {
  const { apiKey } = useApiSettings();
  const base = useApi<any>();

  const request = useCallback(
    async <R>(endpoint: string, options: RequestInit = {}) => {
      const mergedHeaders: HeadersInit = {
        Accept: 'application/json',
        apikey: apiKey || '',
        'X-API-Key': apiKey || '',
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
        ...(options.headers || {}),
      };

      const result = await base.request(endpoint, {
        ...options,
        headers: mergedHeaders,
      });
      return result as R | null;
    },
    [apiKey, base]
  );

  return { data: base.data, error: base.error, loading: base.loading, request };
}