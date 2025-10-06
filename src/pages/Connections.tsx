import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { PlusCircle, QrCode, Power, PowerOff, Loader2, RefreshCw, AlertTriangle, MoreHorizontal, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Connection, ConnectionStatus } from '@/types/database';
import { toast } from 'sonner';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import AlertDialog from '@/components/ui/AlertDialog';

const statusConfig: Record<ConnectionStatus, { text: string; color: string; icon: JSX.Element }> = {
  CONNECTED: { text: 'Conectado', color: 'text-green-500', icon: <Power className="h-4 w-4" /> },
  DISCONNECTED: { text: 'Desconectado', color: 'text-red-500', icon: <PowerOff className="h-4 w-4" /> },
  WAITING_QR_CODE: { text: 'Aguardando QR Code', color: 'text-yellow-500', icon: <QrCode className="h-4 w-4" /> },
  INITIALIZING: { text: 'Inicializando...', color: 'text-blue-500', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
};

const Connections: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isQrModalOpen, setQrModalOpen] = useState(false);
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Connection | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  
  const api = useApi();
  const { user } = useAuth();

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao buscar conexões', { description: error.message });
    } else {
      setConnections(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    const channel = supabase
      .channel('connections-changes')
      .on<Connection>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConnections]);

  const handleCreateInstance = async () => {
    if (!newInstanceName) {
      toast.warning('O nome da instância é obrigatório.');
      return;
    }
    if (!user) {
      toast.error("Você precisa estar logado para criar uma instância.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      const createPayload = {
        instanceName: newInstanceName,
        qrcode: true,
        webhook: {
          url: "https://example.com/webhook", // Placeholder - a API requer um webhook válido
          enabled: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
        }
      };

      const creationResponse = await api.request<{ instance: object; hash: object; qrcode?: { code: string } }>(
        API_ENDPOINTS.INSTANCE_CREATE, 
        {
          method: 'POST',
          body: JSON.stringify(createPayload),
        }
      );

      if (!creationResponse || !creationResponse.instance) {
        throw new Error(api.error || "A API não respondeu à criação da instância.");
      }

      const { error: dbError } = await supabase.from('connections').insert({ 
        instance_name: newInstanceName, 
        status: creationResponse.qrcode?.code ? 'WAITING_QR_CODE' : 'DISCONNECTED',
        user_id: user.id,
        instance_data: creationResponse,
      });
      
      if (dbError) throw new Error(`Falha ao salvar instância no banco: ${dbError.message}`);

      toast.success(`Instância "${newInstanceName}" criada com sucesso.`);
      
      if (creationResponse.qrcode?.code) {
        setSelectedInstance({ instance_name: newInstanceName } as Connection);
        setQrCode(creationResponse.qrcode.code);
        setQrModalOpen(true);
      }

      fetchConnections();
      setCreateModalOpen(false);
      setNewInstanceName('');

    } catch (error: any) {
      toast.error('Falha ao criar instância.', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = async (instance: Connection) => {
    setSelectedInstance(instance);
    setQrModalOpen(true);
    setQrCode(null);

    try {
        await supabase.from('connections').update({ status: 'INITIALIZING' }).eq('id', instance.id);

        const qrResponse = await api.request<{ qrcode?: string }>(
            API_ENDPOINTS.INSTANCE_QR_CODE(instance.instance_name),
            { method: 'GET' }
        );
        
        const qrCodeFromApi = qrResponse?.qrcode;

        if (qrCodeFromApi) {
            setQrCode(qrCodeFromApi);
            await supabase.from('connections').update({ status: 'WAITING_QR_CODE' }).eq('id', instance.id);
        } else {
            toast.warning("A API não retornou um QR Code válido.", { description: "Isso pode acontecer se a instância já estiver conectada. Verifique o status." });
            await supabase.from('connections').update({ status: 'DISCONNECTED' }).eq('id', instance.id);
            setQrModalOpen(false);
        }

    } catch (error: any) {
        toast.error('Falha ao buscar QR Code.', { description: error.message || "Ocorreu um erro na requisição." });
        await supabase.from('connections').update({ status: 'DISCONNECTED' }).eq('id', instance.id);
        setQrModalOpen(false);
    }
  };

  const handleDelete = (instance: Connection) => {
    setSelectedInstance(instance);
    setAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedInstance) return;
    setIsSubmittingDelete(true);
    const { error } = await supabase.from('connections').delete().eq('id', selectedInstance.id);
    if (error) {
      toast.error('Erro ao excluir conexão', { description: error.message });
    } else {
      toast.success('Conexão excluída com sucesso!');
      setConnections(prev => prev.filter(c => c.id !== selectedInstance.id));
      setAlertOpen(false);
      setSelectedInstance(null);
    }
    setIsSubmittingDelete(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Conexões</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar Nova Conexão
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Instâncias do WhatsApp</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : connections.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma conexão encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">Comece criando sua primeira instância do WhatsApp.</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <div className="divide-y divide-border">
                {connections.map((instance) => (
                  <div key={instance.id} className="p-4 flex items-center justify-between hover:bg-accent/50">
                    <div>
                      <p className="font-semibold">{instance.instance_name}</p>
                      <div className={`flex items-center text-sm ${statusConfig[instance.status]?.color || 'text-gray-500'}`}>
                        {statusConfig[instance.status]?.icon || <AlertTriangle className="h-4 w-4" />}
                        <span className="ml-1.5">{statusConfig[instance.status]?.text || 'Desconhecido'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {instance.status !== 'CONNECTED' && (
                        <Button variant="outline" size="sm" onClick={() => handleConnect(instance)} disabled={api.loading}>
                          {api.loading && selectedInstance?.id === instance.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                          Conectar
                        </Button>
                      )}
                      {instance.status === 'CONNECTED' && (
                        <Button variant="destructive" size="sm">
                          <PowerOff className="mr-2 h-4 w-4" /> Desconectar
                        </Button>
                      )}
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 data-[state=open]:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDelete(instance)} className="text-destructive hover:!bg-destructive/10 hover:!text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Criar Nova Conexão">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Use apenas letras minúsculas, números e underscores (ex: vendas_01).</p>
          <div>
            <label htmlFor="instanceName" className="text-sm font-medium">Nome da Instância</label>
            <Input id="instanceName" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="ex: filial_sp" className="mt-1" />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isQrModalOpen} onClose={() => setQrModalOpen(false)} title={`Conectar: ${selectedInstance?.instance_name}`}>
        <div className="flex flex-col items-center justify-center space-y-4 min-h-[300px]">
          {api.loading && !qrCode ? (
            <><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-muted-foreground">Buscando QR Code...</p></>
          ) : qrCode ? (
            <><img src={qrCode} alt="QR Code" /><p className="text-center text-sm text-muted-foreground">Escaneie o código com o WhatsApp.</p></>
          ) : (
            <><AlertTriangle className="h-12 w-12 text-destructive" /><p className="text-destructive text-center">A API não retornou um QR Code válido.<br/>Verifique as configurações.</p></>
          )}
        </div>
      </Modal>

      <AlertDialog
        isOpen={isAlertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={confirmDelete}
        title="Tem certeza que deseja excluir?"
        description="Esta ação não pode ser desfeita. A instância será removida permanentemente."
        confirmText="Excluir"
        isConfirming={isSubmittingDelete}
      />
    </div>
  );
};

export default Connections;
