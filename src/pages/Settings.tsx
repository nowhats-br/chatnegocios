import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { useApiSettings } from '@/contexts/ApiSettingsContext';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Wifi } from 'lucide-react';
import { toast } from 'sonner';

const settingsSchema = z.object({
  apiUrl: z.string().url("Por favor, insira uma URL válida."),
  apiKey: z.string().min(1, "A chave de API é obrigatória."),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { apiUrl, apiKey, loading, updateSettings, isConfigured } = useApiSettings();
  const { request: evolutionApiRequest } = useEvolutionApi();
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const watchedApiUrl = watch('apiUrl');
  const watchedApiKey = watch('apiKey');

  useEffect(() => {
    if (!loading) {
      reset({
        apiUrl: apiUrl || '',
        apiKey: apiKey || '',
      });
    }
  }, [apiUrl, apiKey, loading, reset]);

  // Reset connection status when form values change
  useEffect(() => {
    if (connectionStatus !== 'idle') {
      setConnectionStatus('idle');
      setConnectionMessage('');
    }
  }, [watchedApiUrl, watchedApiKey]);

  const testConnection = async () => {
    const currentApiUrl = watchedApiUrl;
    const currentApiKey = watchedApiKey;

    if (!currentApiUrl || !currentApiKey) {
      toast.error('Preencha URL e Chave de API antes de testar');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      // Temporarily update settings for testing
      await updateSettings(currentApiUrl, currentApiKey);

      // Test connection with a simple endpoint
      const testEndpoints = [
        '/manager/findInstances',
        '/instances',
        '/v1/instances',
        '/instance/fetchInstances',
      ];

      let testSuccess = false;
      let lastError = '';

      for (const endpoint of testEndpoints) {
        try {
          const response = await evolutionApiRequest<any>(endpoint, {
            method: 'GET',
            suppressToast: true,
          });

          if (response !== null) {
            testSuccess = true;
            setConnectionStatus('success');
            setConnectionMessage('Conexão estabelecida com sucesso! API Evolution está respondendo.');
            toast.success('Conexão testada com sucesso!');
            break;
          }
        } catch (e: any) {
          lastError = e.message || 'Erro desconhecido';
          continue;
        }
      }

      if (!testSuccess) {
        setConnectionStatus('error');
        setConnectionMessage(`Falha na conexão: ${lastError}`);
        toast.error('Falha no teste de conexão', { description: lastError });
      }

    } catch (error: any) {
      setConnectionStatus('error');
      setConnectionMessage(`Erro ao testar conexão: ${error.message}`);
      toast.error('Erro ao testar conexão', { description: error.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      await updateSettings(data.apiUrl, data.apiKey);
      toast.success('Configurações salvas com sucesso!');
      
      // Auto-test connection after saving
      setTimeout(() => {
        testConnection();
      }, 500);
    } catch (error: any) {
      toast.error('Erro ao salvar configurações', { description: error.message });
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-error" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Wifi className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'success':
        return 'text-success bg-success/10 border-success/20';
      case 'error':
        return 'text-error bg-error/10 border-error/20';
      case 'warning':
        return 'text-warning bg-warning/10 border-warning/20';
      default:
        return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="typography-h1">Configurações</h1>
        <p className="typography-body text-muted-foreground">
          Configure a integração com a API Evolution para gerenciar suas instâncias WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Configuração da API Evolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="apiUrl">URL da API Evolution</Label>
                    <Input
                      id="apiUrl"
                      placeholder="https://sua-api-evolution.com.br"
                      {...register('apiUrl')}
                      className="mt-1"
                    />
                    {errors.apiUrl && (
                      <p className="typography-body-sm text-error mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {errors.apiUrl.message}
                      </p>
                    )}
                    <p className="typography-body-sm text-muted-foreground mt-1">
                      URL completa da sua instância da API Evolution (incluindo protocolo)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="apiKey">Chave de API (Global API Key)</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Sua chave de API global"
                      {...register('apiKey')}
                      className="mt-1"
                    />
                    {errors.apiKey && (
                      <p className="typography-body-sm text-error mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {errors.apiKey.message}
                      </p>
                    )}
                    <p className="typography-body-sm text-muted-foreground mt-1">
                      Chave de API global configurada na sua instância Evolution
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações
                  </Button>

                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={testConnection}
                    disabled={testingConnection || !watchedApiUrl || !watchedApiKey}
                  >
                    {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Testar Conexão
                  </Button>
                </div>
              </form>

              {/* Connection Status */}
              {(connectionStatus !== 'idle' || connectionMessage) && (
                <div className={`p-4 rounded-lg border ${getConnectionStatusColor()}`}>
                  <div className="flex items-start gap-3">
                    {getConnectionStatusIcon()}
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {connectionStatus === 'success' && 'Conexão Estabelecida'}
                        {connectionStatus === 'error' && 'Falha na Conexão'}
                        {connectionStatus === 'warning' && 'Aviso de Conexão'}
                      </h4>
                      {connectionMessage && (
                        <p className="typography-body-sm mt-1 opacity-90">
                          {connectionMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Status */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-3">Status Atual</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Configuração:</span>
                    <span className={`ml-2 font-medium ${isConfigured ? 'text-success' : 'text-error'}`}>
                      {isConfigured ? 'Completa' : 'Incompleta'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">URL da API:</span>
                    <span className="ml-2 font-medium">
                      {apiUrl ? 'Configurada' : 'Não configurada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Chave de API:</span>
                    <span className="ml-2 font-medium">
                      {apiKey ? 'Configurada' : 'Não configurada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Última Conexão:</span>
                    <span className={`ml-2 font-medium ${
                      connectionStatus === 'success' ? 'text-success' : 
                      connectionStatus === 'error' ? 'text-error' : 'text-muted-foreground'
                    }`}>
                      {connectionStatus === 'success' ? 'Sucesso' : 
                       connectionStatus === 'error' ? 'Falha' : 'Não testada'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-info/10 border border-info/20 rounded-lg p-4">
                <h4 className="font-medium text-info mb-2">Como configurar</h4>
                <ul className="typography-body-sm text-info/80 space-y-1">
                  <li>• Certifique-se de que sua API Evolution está rodando e acessível</li>
                  <li>• Use a URL completa incluindo protocolo (http:// ou https://)</li>
                  <li>• A chave de API deve ser a Global API Key configurada na Evolution</li>
                  <li>• Teste a conexão após salvar para verificar se está funcionando</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atualizações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
             <p className="typography-body-sm typography-muted">A funcionalidade de atualização via UI foi desabilitada nesta versão. Para atualizar, use os comandos `git pull` no servidor.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
