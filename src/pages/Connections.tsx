import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Badge from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Plus, QrCode, Loader2, RefreshCw, AlertTriangle, MoreHorizontal, Trash2, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Connection } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import AlertDialog from '@/components/ui/AlertDialog';
import { 
  EvolutionInstanceCreateRequest, 
  EvolutionInstanceCreateResponse, 
  EvolutionInstanceConnectResponse,
  STATUS_CONFIG,
  STATUS_MAPPING,
} from '@/types/evolution-api';

type UiStatus = keyof typeof STATUS_CONFIG;


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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  
  const { user } = useAuth();
  const { request: evolutionApiRequest, error: evolutionError } = useEvolutionApi();
  const qrEndpointTemplate = import.meta.env.VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE as string | undefined;
  const webhookUrlEnv = import.meta.env.VITE_EVOLUTION_WEBHOOK_URL as string | undefined;

  const fetchQrDataWithFallback = async (instanceName: string) => {
    const candidates: Array<{ endpoint: string; method: 'GET' | 'POST' }> = [
      // Template configurável via .env (ex.: /instance/qrCode/{instanceName})
      ...(qrEndpointTemplate ? [{ endpoint: qrEndpointTemplate.replace('{instanceName}', instanceName), method: 'GET' as const }] : []),
      { endpoint: API_ENDPOINTS.INSTANCE_QR_CODE(instanceName), method: 'GET' },
      { endpoint: `/instance/qrcode/${instanceName}`, method: 'GET' },
      { endpoint: `/instance/qr-code/${instanceName}`, method: 'GET' },
      { endpoint: `/instance/connect/${instanceName}/qrcode`, method: 'GET' },
      { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(instanceName), method: 'GET' },
      // Tentativas com POST (alguns provedores exigem POST)
      ...(qrEndpointTemplate ? [{ endpoint: qrEndpointTemplate.replace('{instanceName}', instanceName), method: 'POST' as const }] : []),
      { endpoint: API_ENDPOINTS.INSTANCE_QR_CODE(instanceName), method: 'POST' },
      { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(instanceName), method: 'POST' },
    ];

    for (const { endpoint, method } of candidates) {
      const res = await evolutionApiRequest<any>(endpoint, { 
        method,
        ...(method === 'POST' ? { body: JSON.stringify({ qrcode: true }) } : {}),
      });
      const qrCode = res?.qrcode?.base64
        || res?.qrcode?.image
        || res?.qrcode
        || res?.base64
        || res?.code
        || '';
      const pairing = res?.pairingCode || '';

      if (qrCode || pairing) {
        return { qrCode, pairing, usedEndpoint: endpoint, usedMethod: method };
      }
    }

    return null;
  };

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
    if (!newConnectionName.trim()) {
      toast.error('Nome da instância é obrigatório.');
      return;
    }
    if (!user) {
      toast.error("Você precisa estar logado para criar uma instância.");
      return;
    }
    setIsCreating(true);
    
    try {
      const createPayload: EvolutionInstanceCreateRequest = {
        instanceName: newConnectionName,
        qrcode: false, // Não gerar QR Code automaticamente
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookUrlEnv || `${window.location.origin}/webhook`,
          enabled: Boolean(webhookUrlEnv),
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
        }
      };

      const creationResponse = await evolutionApiRequest<EvolutionInstanceCreateResponse>(
        API_ENDPOINTS.INSTANCE_CREATE, 
        {
          method: 'POST',
          body: JSON.stringify(createPayload),
        }
      );

      if (!creationResponse || !creationResponse.instance) {
        throw new Error("A Evolution API não respondeu à criação da instância.");
      }

      // Salvar no Supabase com status inicial DISCONNECTED
      const { error: dbError } = await supabase.from('connections').insert({ 
        instance_name: newConnectionName, 
        status: 'DISCONNECTED', // Status inicial sempre desconectado
        user_id: user.id,
        instance_data: creationResponse,
      });
      
      if (dbError) throw new Error(`Falha ao salvar instância no banco: ${dbError.message}`);

      toast.success(`Instância "${newConnectionName}" criada com sucesso.`);
      
      await fetchConnections();
      setIsCreateModalOpen(false);
      setNewConnectionName('');

    } catch (error: any) {
      toast.error('Falha ao criar instância.', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = async (connection: Connection) => {
    setSelectedConnection(connection);
    setIsConnecting(true);
    setIsQrModalOpen(true);
    setQrCodeData('');
    setPairingCode('');

    try {
      // Atualizar status para connecting
      await supabase.from('connections').update({ 
        status: 'connecting' 
      }).eq('id', connection.id);

      // 1) Chamar endpoint de conexão da Evolution API
      const connectResponse = await evolutionApiRequest<any>(
        API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name),
        { method: 'GET' }
      );

      if (!connectResponse) {
        throw new Error("A Evolution API não respondeu à solicitação de conexão.");
      }

      // 2) Buscar QR Code com fallback de endpoints
      const qrData = await fetchQrDataWithFallback(connection.instance_name);

      if (qrData?.qrCode) {
        setQrCodeData(qrData.qrCode);
        await supabase.from('connections').update({ status: 'connecting' }).eq('id', connection.id);
        toast.success("QR Code gerado com sucesso! Escaneie com seu WhatsApp.", { description: `Endpoint: ${qrData.usedEndpoint} (${qrData.usedMethod})` });
      } else if (qrData?.pairing) {
        setPairingCode(qrData.pairing);
        await supabase.from('connections').update({ status: 'connecting' }).eq('id', connection.id);
        toast.success("Código de pareamento gerado! Use-o para conectar.", { description: `Endpoint: ${qrData.usedEndpoint} (${qrData.usedMethod})` });
      } else {
        const lastError = evolutionError ? ` Detalhes: ${evolutionError}` : '';
        throw new Error(`QR Code não foi retornado pela API. Tente novamente em alguns segundos.${lastError}`);
      }

    } catch (error: any) {
      toast.error('Falha ao gerar QR Code.', { description: error.message });
      
      // Reverter status para disconnected em caso de erro
      await supabase.from('connections').update({ 
        status: 'disconnected' 
      }).eq('id', connection.id);
      
      setIsQrModalOpen(false);
    } finally {
      setIsConnecting(false);
      await fetchConnections(); // Atualizar lista
    }
  };

  const handleDelete = (connection: Connection) => {
    setConnectionToDelete(connection);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!connectionToDelete) return;
    setIsDeleting(true);

    try {
      // Primeiro, deletar da Evolution API
      await evolutionApiRequest(
        API_ENDPOINTS.INSTANCE_DELETE(connectionToDelete.instance_name),
        { method: 'DELETE' }
      );

      // Depois, deletar do Supabase
      const { error } = await supabase.from('connections').delete().eq('id', connectionToDelete.id);
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success('Conexão excluída com sucesso!');
      setConnections(prev => prev.filter(c => c.id !== connectionToDelete.id));
      setIsDeleteDialogOpen(false);
      setConnectionToDelete(null);
      
    } catch (error: any) {
      toast.error('Erro ao excluir conexão', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
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

      <Card>
        <CardHeader><CardTitle>Instâncias do WhatsApp</CardTitle></CardHeader>
        <div className="p-6 pt-0">
          {loading && (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && connections.length === 0 && (
            <div className="text-center py-10">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma conexão encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">Comece criando sua primeira instância do WhatsApp.</p>
            </div>
          )}

          {!loading && connections.length > 0 && (
            <div className="border rounded-lg">
              <div className="divide-y divide-border">
                {connections.map((connection) => {
                  const uiStatus: UiStatus = (STATUS_MAPPING[connection.status as keyof typeof STATUS_MAPPING] || 'disconnected') as UiStatus;
                  const statusInfo = STATUS_CONFIG[uiStatus];
                  const isConnectionConnecting = isConnecting && selectedConnection?.id === connection.id;

                  return (
                    <div key={connection.id} className="p-4 flex items-center justify-between hover:bg-accent/50">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{connection.instance_name}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.text}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {uiStatus === 'disconnected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnect(connection)}
                            disabled={isConnectionConnecting}
                          >
                            {isConnectionConnecting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <QrCode className="mr-2 h-4 w-4" />
                            )}
                            {statusInfo.action || 'Conectar'}
                          </Button>
                        )}
                        {uiStatus === 'connected' && (
                          <Button variant="destructive" size="sm">
                            <Smartphone className="mr-2 h-4 w-4" />
                            Desconectar
                          </Button>
                        )}
                        {uiStatus === 'connecting' && (
                          <Button variant="outline" size="sm" disabled>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Conectando...
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
                            <DropdownMenuItem
                              onClick={() => handleDelete(connection)}
                              className="text-destructive hover:!bg-destructive/10 hover:!text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Modal de Criação */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Conexão</DialogTitle>
            <DialogDescription>
              Crie uma nova instância do WhatsApp. Use apenas letras minúsculas, números e underscores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input 
                id="instanceName" 
                value={newConnectionName} 
                onChange={(e) => setNewConnectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                placeholder="ex: vendas_01" 
                className="mt-1" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInstance} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal do QR Code */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              {selectedConnection?.instance_name && `Instância: ${selectedConnection.instance_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 min-h-[300px]">
            {isConnecting && !qrCodeData && !pairingCode ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Gerando QR Code...</p>
              </>
            ) : qrCodeData ? (
              <>
                <div className="p-4 bg-white rounded-lg">
                  <img 
                    src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Escaneie o código QR com o WhatsApp para conectar
                </p>
              </>
            ) : pairingCode ? (
              <>
                <div className="p-4 bg-white rounded-lg text-center">
                  <p className="text-lg font-semibold">Código de Pareamento</p>
                  <p className="text-2xl tracking-wider mt-2">{pairingCode}</p>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Insira este código no WhatsApp para parear sua instância.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <p className="text-destructive text-center">
                  Não foi possível obter QR Code ou código de pareamento.<br/>
                  Tente novamente e verifique as configurações da API.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        description={`Tem certeza que deseja excluir a instância "${connectionToDelete?.instance_name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        isConfirming={isDeleting}
      />
    </div>
  );
}
