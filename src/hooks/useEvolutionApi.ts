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

      const controller = new AbortController();
      const timeoutMs = 20000; // 20s timeout para evitar espera excessiva
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const isGet = !options.method || options.method.toString().toUpperCase() === 'GET';
      const headers: HeadersInit = {
        'Accept': 'application/json',
        ...(!isGet ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      };
      // Header de autenticação: suporta apikey e Authorization Bearer
      if (/^Bearer\s+/i.test(String(evolutionApiKey))) {
        (headers as any)['Authorization'] = String(evolutionApiKey);
      } else {
        (headers as any)['apikey'] = String(evolutionApiKey);
      }

      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorData: EvolutionApiError = { message: `Erro HTTP ${response.status}: ${response.statusText}`, statusCode: response.status };
        if (contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch {
            // mantém mensagem padrão
          }
        } else {
          // Pode ser página de provedor (ex.: Render) indicando boot lento
          const text = await response.text().catch(() => '');
          if (text && /taking longer than expected to load/i.test(text)) {
            errorData.message = 'O serviço Evolution API está iniciando/indisponível. Tente novamente em alguns minutos.';
          } else if (text) {
            errorData.message = `Resposta não-JSON (${response.status}): ${text.slice(0, 160)}...`;
          }
        }
        const method = (options.method || 'GET').toString();
        const detailedMessage = `${errorData.message || `Erro na requisição: ${response.status}`}`+
          ` | URL: ${fullUrl} | Método: ${method}`;
        throw new Error(detailedMessage);
      }

      // Conteúdo deve ser JSON; se não for, tratar como erro com dica
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        const method = (options.method || 'GET').toString();
        const msg = text && /taking longer than expected to load/i.test(text)
          ? 'O serviço Evolution API está iniciando/indisponível. Tente novamente em alguns minutos.'
          : `Resposta não-JSON inesperada | URL: ${fullUrl} | Método: ${method} | Conteúdo: ${text.slice(0, 160)}...`;
        throw new Error(msg);
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