import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Modal from '@/components/ui/Modal';
import { Plus, QrCode, Loader2, RefreshCw, AlertTriangle, Smartphone, Trash2, MoreVertical, PowerOff, Power, Pause } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { Connection, ConnectionStatus } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import AlertDialog from '@/components/ui/AlertDialog';
import { EvolutionInstanceCreateResponse, STATUS_CONFIG } from '@/types/evolution-api';
import { supabase } from '@/lib/supabase';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/DropdownMenu';

type UiStatus = keyof typeof STATUS_CONFIG;

const normalizeStatus = (status: ConnectionStatus): UiStatus => {
  if (status === 'CONNECTED') return 'connected';
  if (status === 'INITIALIZING' || status === 'WAITING_QR_CODE') return 'connecting';
  if (status === 'PAUSED') return 'paused';
  return 'disconnected';
};

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [newConnectionName, setNewConnectionName] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { user } = useAuth();
  const { request: evolutionApiRequest, loading: apiLoading } = useEvolutionApi();
  const webhookUrlEnv = import.meta.env.VITE_EVOLUTION_WEBHOOK_URL as string | undefined;
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbClient.connections.list();
      setConnections(data);
    } catch (error: any) {
      toast.error('Erro ao buscar conexões', { description: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('public:connections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections', filter: `user_id=eq.${user.id}` },
        () => {
          fetchConnections();
        }
      ).subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConnections]);

  useEffect(() => {
    if (!isQrModalOpen || !selectedConnection) return;
    const updated = connections.find(c => c.id === selectedConnection.id);
    if (!updated) return;
    setSelectedConnection(updated);
    const uiStatus = normalizeStatus(updated.status);
    if (uiStatus === 'connected') {
      setIsQrModalOpen(false);
      setQrCodeData('');
      setPairingCode('');
      toast.success('Conectado com sucesso.');
    }
  }, [connections, isQrModalOpen, selectedConnection]);

  const handleConnect = async (connection: Connection) => {
    setSelectedConnection(connection);
    setIsQrModalOpen(true);
    setIsConnecting(connection.id);
    setQrCodeData('');
    setPairingCode('');

    try {
      const res = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });

      let qr = res?.base64 || res?.qrcode;
      let pairing = res?.pairingCode;

      if (!qr && !pairing) {
        const qrRes = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_QR_CODE(connection.instance_name), {
          method: 'GET',
          suppressToast: true,
        });
        qr = qrRes?.base64 || qrRes?.qrcode;
        pairing = pairing || qrRes?.pairingCode;
      }

      if (qr) setQrCodeData(qr);
      if (pairing) setPairingCode(pairing);

      if (!qr && !pairing) {
        toast.warning("QR Code não recebido. A instância pode já estar conectando.");
      }
    } catch (error: any) {
      toast.error('Erro ao iniciar conexão', { description: error.message });
      setIsQrModalOpen(false);
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (connection: Connection) => {
    try {
      await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_LOGOUT(connection.instance_name), {
        method: 'POST',
        suppressToast: true,
      });
      toast.success('Comando de desconexão enviado.');
    } catch (error: any) {
      toast.error('Erro ao desconectar', { description: error.message });
    }
  };

  const handlePause = async (connection: Connection) => {
    try {
      await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_PAUSE(connection.instance_name), {
        method: 'POST',
        suppressToast: true,
      });
      toast.success('Comando para pausar enviado.');
      await dbClient.connections.update(connection.id, { status: 'PAUSED' });
    } catch (error: any) {
      toast.error('Erro ao pausar conexão', { description: error.message });
    }
  };

  const handleResume = async (connection: Connection) => {
    await handleConnect(connection);
    toast.info('Tentando retomar a conexão...');
  };

  const confirmDelete = async () => {
    if (!selectedConnection) return;
    setIsDeleting(true);
    try {
      await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_DELETE(selectedConnection.instance_name), {
        method: 'DELETE',
        suppressToast: true,
      }).catch(e => console.warn("Falha ao deletar na API Evolution, prosseguindo com a exclusão local:", e.message));

      await dbClient.connections.delete(selectedConnection.id);
      
      toast.success('Instância excluída com sucesso.');
      setIsDeleteDialogOpen(false);
      setSelectedConnection(null);
    } catch (error: any) {
      toast.error('Erro ao excluir instância', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!newConnectionName.trim()) {
      toast.error('Nome da instância é obrigatório.');
      return;
    }
    if (!user) {
      toast.error("Você precisa estar logado para criar uma instância.");
      return;
    }
    setIsCreating(true);

    let finalWebhookUrl = webhookUrlEnv;
    if (!finalWebhookUrl) {
      if (backendUrl) {
        const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
        finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
      } else {
        finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
      }
    }

    if (!finalWebhookUrl) {
      toast.error("Configuração Incompleta", { description: "A URL do webhook não pôde ser determinada. Verifique VITE_BACKEND_URL ou VITE_EVOLUTION_WEBHOOK_URL no seu arquivo .env." });
      setIsCreating(false);
      return;
    }
    
    try {
      const createPayload: any = {
        instanceName: newConnectionName,
        qrcode: false,
        webhook: {
          url: finalWebhookUrl,
          webhookByEvents: true,
          events: [
            "APPLICATION_STARTUP", "QRCODE_UPDATED", "MESSAGES_SET", "MESSAGES_UPSERT",
            "MESSAGES_UPDATE", "SEND_MESSAGE", "CONTACTS_SET", "CONTACTS_UPSERT",
            "CONTACTS_UPDATE", "PRESENCE_UPDATE", "CHATS_SET", "CHATS_UPSERT",
            "CHATS_UPDATE", "CHATS_DELETE", "GROUPS_UPSERT", "GROUPS_UPDATE",
            "GROUP_PARTICIPANTS_UPDATE", "CONNECTION_UPDATE",
          ],
          headers: { 'x-user-id': user.id },
        },
        settings: {
          "reject_call": "true",
          "messages_read": "read",
          "webhook_by_events": true,
          "webhook_base64": false
        },
        integration: 'whatsapp-web.js'
      };

      const creationResponse = await evolutionApiRequest<EvolutionInstanceCreateResponse>(API_ENDPOINTS.INSTANCE_CREATE, {
        method: 'POST',
        body: JSON.stringify(createPayload),
        suppressToast: true,
      });

      if (!creationResponse || (creationResponse.status === 'error' && creationResponse.message)) {
        throw new Error(creationResponse?.message || "A API Evolution não respondeu à criação da instância. Verifique se a URL da API está correta e acessível.");
      }

      await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        instance_data: creationResponse,
      });

      toast.success(`Instância "${newConnectionName}" criada com sucesso.`);
      setIsCreateModalOpen(false);
      setNewConnectionName('');

    } catch (error: any) {
      toast.error('Falha ao criar instância.', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const getPhoneNumber = (connection: Connection) => {
    const instanceData = connection.instance_data as any;
    return instanceData?.owner?.split('@')[0] || 'Não disponível';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Conexões</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conexão
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading && <div className="col-span-full flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        {!loading && connections.length === 0 && (
          <div className="col-span-full text-center py-10 bg-card rounded-lg border">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma conexão encontrada</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comece criando sua primeira instância do WhatsApp.</p>
          </div>
        )}
        {!loading && connections.map((connection) => {
          const uiStatus: UiStatus = normalizeStatus(connection.status);
          const statusInfo = STATUS_CONFIG[uiStatus];
          const isSelectedAndConnecting = isConnecting === connection.id;

          return (
            <Card key={connection.id} className="flex flex-col justify-between">
              <div>
                <CardHeader className="flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />{connection.instance_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{getPhoneNumber(connection)}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                    {statusInfo.text}
                  </span>
                </CardHeader>
              </div>
              <CardContent>
                <div className="flex items-center gap-2">
                    {uiStatus === 'disconnected' && (
                      <Button className="w-full" onClick={() => handleConnect(connection)} disabled={isSelectedAndConnecting || apiLoading}>
                        {isSelectedAndConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                        Conectar
                      </Button>
                    )}
                    {uiStatus === 'connected' && (
                      <>
                        <Button variant="outline" className="flex-1" onClick={() => handlePause(connection)} disabled={apiLoading}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={() => handleDisconnect(connection)} disabled={apiLoading}>
                          <PowerOff className="mr-2 h-4 w-4" />
                          Desconectar
                        </Button>
                      </>
                    )}
                    {uiStatus === 'connecting' && (
                      <Button className="w-full" variant="outline" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Conectando...
                      </Button>
                    )}
                    {uiStatus === 'paused' && (
                      <Button className="w-full" onClick={() => handleResume(connection)} disabled={isSelectedAndConnecting || apiLoading}>
                        {isSelectedAndConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                        Retomar
                      </Button>
                    )}
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleConnect(connection)}>
                          <QrCode className="mr-2 h-4 w-4" />
                          Ver QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500" onSelect={() => { setSelectedConnection(connection); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Criar Nova Conexão">
        <div className="space-y-4">
          <div>
            <Label htmlFor="instanceName">Nome da Instância</Label>
            <Input id="instanceName" value={newConnectionName} onChange={(e) => setNewConnectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="ex: vendas_01" className="mt-1" />
            <p className="mt-2 text-sm text-muted-foreground">Use apenas letras minúsculas, números e underscores.</p>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Instância
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Conectar WhatsApp">
        <div className="text-center text-sm text-muted-foreground mb-4">
          Instância: <strong>{selectedConnection?.instance_name}</strong>
        </div>
        <div className="flex flex-col items-center justify-center space-y-4 min-h-[300px]">
            {(isConnecting || apiLoading) && !qrCodeData && !pairingCode ? (
              <><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-muted-foreground">Gerando QR Code...</p></>
            ) : qrCodeData ? (
              <><div className="p-4 bg-white rounded-lg"><img src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`} alt="QR Code" className="w-64 h-64"/></div><p className="text-center text-sm text-muted-foreground">Escaneie o código QR com o WhatsApp para conectar</p></>
            ) : pairingCode ? (
              <><div className="p-4 bg-white rounded-lg text-center"><p className="text-lg font-semibold">Código de Pareamento</p><p className="text-2xl tracking-wider mt-2">{pairingCode}</p></div><p className="text-center text-sm text-muted-foreground">Insira este código no WhatsApp para parear sua instância.</p></>
            ) : (
              <><AlertTriangle className="h-12 w-12 text-destructive" /><p className="text-destructive text-center">Não foi possível obter QR Code.<br/>Tente novamente e verifique as configurações da API.</p></>
            )}
        </div>
        <div className="flex items-center justify-end mt-4">
          <Button variant="outline" onClick={() => setIsQrModalOpen(false)}>Fechar</Button>
        </div>
      </Modal>

      <AlertDialog isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} onConfirm={confirmDelete} title="Confirmar Exclusão" description={`Tem certeza que deseja excluir a instância "${selectedConnection?.instance_name}"? Esta ação não pode ser desfeita.`} confirmText="Excluir" isConfirming={isDeleting}/>
    </div>
  );
}
