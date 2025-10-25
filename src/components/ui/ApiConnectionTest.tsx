import { useState } from 'react';
import Button from './Button';
import { useEvolutionApi } from '../../hooks/useEvolutionApi';
import { useApiSettings } from '../../contexts/ApiSettingsContext';
import { CheckCircle, XCircle, Loader2, Wifi, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface ApiConnectionTestProps {
  className?: string;
  onTestComplete?: (success: boolean, message: string) => void;
}

export function ApiConnectionTest({ className, onTestComplete }: ApiConnectionTestProps) {
  const { request: evolutionApiRequest } = useEvolutionApi();
  const { isConfigured, apiUrl, apiKey } = useApiSettings();
  const [testing, setTesting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: Date;
  } | null>(null);

  const testConnection = async () => {
    if (!isConfigured) {
      toast.error('Configure a URL e Chave de API primeiro');
      return;
    }

    setTesting(true);
    
    try {
      // Lista de endpoints para testar compatibilidade
      const testEndpoints = [
        { path: '/manager/findInstances', name: 'Manager Find Instances' },
        { path: '/instances', name: 'List Instances' },
        { path: '/v1/instances', name: 'V1 List Instances' },
        { path: '/instance/fetchInstances', name: 'Fetch Instances' },
        { path: '/', name: 'Root Endpoint' },
      ];

      let successfulEndpoint = null;
      let lastError = '';

      for (const endpoint of testEndpoints) {
        try {
          console.log(`Testando endpoint: ${endpoint.path}`);
          
          const response = await evolutionApiRequest<any>(endpoint.path, {
            method: 'GET',
            suppressToast: true,
          });

          if (response !== null) {
            successfulEndpoint = endpoint;
            console.log(`Sucesso no endpoint: ${endpoint.path}`, response);
            break;
          }
        } catch (e: any) {
          lastError = e.message || 'Erro desconhecido';
          console.warn(`Falha no endpoint ${endpoint.path}:`, e.message);
          continue;
        }
      }

      if (successfulEndpoint) {
        const message = `Conexão estabelecida com sucesso via ${successfulEndpoint.name}`;
        setLastTestResult({
          success: true,
          message,
          timestamp: new Date(),
        });
        toast.success('API Evolution conectada!', { description: message });
        onTestComplete?.(true, message);
      } else {
        const message = `Falha em todos os endpoints testados. Último erro: ${lastError}`;
        setLastTestResult({
          success: false,
          message,
          timestamp: new Date(),
        });
        toast.error('Falha na conexão', { description: message });
        onTestComplete?.(false, message);
      }

    } catch (error: any) {
      const message = `Erro ao testar conexão: ${error.message}`;
      setLastTestResult({
        success: false,
        message,
        timestamp: new Date(),
      });
      toast.error('Erro no teste', { description: error.message });
      onTestComplete?.(false, message);
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (testing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    
    if (!lastTestResult) {
      return <Wifi className="h-4 w-4" />;
    }
    
    return lastTestResult.success ? 
      <CheckCircle className="h-4 w-4 text-success" /> : 
      <XCircle className="h-4 w-4 text-error" />;
  };

  const getStatusColor = () => {
    if (!lastTestResult) return 'text-muted-foreground';
    return lastTestResult.success ? 'text-success' : 'text-error';
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={testing || !isConfigured}
          className="flex items-center gap-2"
        >
          {getStatusIcon()}
          {testing ? 'Testando...' : 'Testar Conexão'}
        </Button>
        
        {lastTestResult && (
          <div className={cn("text-sm", getStatusColor())}>
            {lastTestResult.success ? 'Conectado' : 'Falha'}
          </div>
        )}
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <div className="text-sm text-warning">
            Configure a URL e Chave de API nas configurações antes de testar a conexão.
          </div>
        </div>
      )}

      {lastTestResult && (
        <div className={cn(
          "p-3 rounded-lg border text-sm",
          lastTestResult.success 
            ? "bg-success/10 border-success/20 text-success" 
            : "bg-error/10 border-error/20 text-error"
        )}>
          <div className="font-medium mb-1">
            {lastTestResult.success ? 'Teste bem-sucedido' : 'Teste falhou'}
          </div>
          <div className="opacity-90 mb-2">
            {lastTestResult.message}
          </div>
          <div className="text-xs opacity-70">
            Testado em: {lastTestResult.timestamp.toLocaleString()}
          </div>
        </div>
      )}

      {isConfigured && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>URL: {apiUrl}</div>
          <div>API Key: {apiKey ? '••••••••' : 'Não configurada'}</div>
        </div>
      )}
    </div>
  );
}