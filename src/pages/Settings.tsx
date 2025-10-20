import React, { useEffect, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { useApiSettings } from '@/contexts/ApiSettingsContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';

const settingsSchema = z.object({
  apiUrl: z.string().url("Por favor, insira uma URL válida."),
  apiKey: z.string().min(1, "A chave de API é obrigatória."),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { apiUrl, apiKey, loading, updateSettings } = useApiSettings();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const [checking, setChecking] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    currentSha: string;
    latestSha: string;
    latestMessage: string;
    latestDate: string;
    branch: string;
  } | null>(null);

  useEffect(() => {
    if (!loading) {
      reset({
        apiUrl: apiUrl || '',
        apiKey: apiKey || '',
      });
    }
  }, [apiUrl, apiKey, loading, reset]);

  const onSubmit = async (data: SettingsFormData) => {
    await updateSettings(data.apiUrl, data.apiKey);
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const info = await dbClient.system.updateCheck();
      setUpdateInfo(info);
    } catch (err: any) {
      setUpdateError(err?.message || 'Falha ao verificar atualizações.');
    } finally {
      setChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setApplyLoading(true);
    setUpdateError(null);
    try {
      const res = await dbClient.system.updateApply();
      if (res.ok) {
        // Após aplicar, recomendamos recarregar a página para refletir mudanças
        await handleCheckUpdates();
      } else {
        setUpdateError('Atualização não aplicada.');
      }
    } catch (err: any) {
      setUpdateError(err?.message || 'Falha ao aplicar atualização.');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuração da API Evolution</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
              <div>
                <Label htmlFor="apiUrl">URL da API Evolution</Label>
                <Input
                  id="apiUrl"
                  placeholder="https://sua-api.com.br"
                  {...register('apiUrl')}
                  className="mt-1"
                />
                {errors.apiUrl && <p className="text-sm text-red-500 mt-1">{errors.apiUrl.message}</p>}
              </div>
              <div>
                <Label htmlFor="apiKey">Chave de API (apikey)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Sua chave de API global"
                  {...register('apiKey')}
                  className="mt-1"
                />
                {errors.apiKey && <p className="text-sm text-red-500 mt-1">{errors.apiKey.message}</p>}
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configurações
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atualizações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleCheckUpdates} disabled={checking}>
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar atualizações
              </Button>
              {updateInfo && (
                updateInfo.available ? (
                  <span className="inline-flex items-center text-amber-600">
                    <AlertCircle className="mr-1 h-4 w-4" />
                    Atualização disponível
                  </span>
                ) : (
                  <span className="inline-flex items-center text-green-600">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Sistema está atualizado
                  </span>
                )
              )}
            </div>

            {updateError && (
              <p className="text-sm text-red-600">{updateError}</p>
            )}

            {updateInfo && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Branch:</strong> {updateInfo.branch}</p>
                <p><strong>Commit atual:</strong> {updateInfo.currentSha}</p>
                <p><strong>Último commit remoto:</strong> {updateInfo.latestSha}</p>
                {updateInfo.latestMessage && <p><strong>Mensagem:</strong> {updateInfo.latestMessage}</p>}
                {updateInfo.latestDate && <p><strong>Data:</strong> {updateInfo.latestDate}</p>}
              </div>
            )}

            {updateInfo?.available && (
              <div>
                <Button variant="secondary" onClick={handleApplyUpdate} disabled={applyLoading}>
                  {applyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aplicar atualização
                </Button>
              </div>
            )}

            {!updateInfo && (
              <p className="text-sm text-muted-foreground">Clique em "Verificar atualizações" para checar se há novidades no GitHub.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
