import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { useApiSettings } from '@/contexts/ApiSettingsContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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
             <p className="text-sm text-muted-foreground">A funcionalidade de atualização via UI foi desabilitada nesta versão. Para atualizar, use os comandos `git pull` no servidor.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
