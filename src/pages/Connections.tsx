import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Modal from '@/components/ui/Modal';
import { Plus, Loader2, RefreshCw, Smartphone, WifiOff, Pause, Play, Trash2, QrCode, Phone, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { Connection } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import AlertDialog from '@/components/ui/AlertDialog';
import { EvolutionInstanceCreateResponse } from '@/types/evolution-api';
import { supabase } from '@/lib/supabase';

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [newConnectionName, setNewConnectionName] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [connectionCheckInterval, setConnectionCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [connectedInstances, setConnectedInstances] = useState<Set<string>>(new Set());
  
  const { user } = useAuth();
  const { request: evolutionApiRequest } = useEvolutionApi();

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
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
    };
  }, [user, fetchConnections, connectionCheckInterval]);

  const checkConnectionStatus = async (connection: Connection) => {
    try {
      const statusResponse = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });

      if (statusResponse?.instance?.state === 'open') {
        await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
        ));
        
        setIsQrModalOpen(false);
        setSelectedConnection(null);
        
        if (connectionCheckInterval) {
          clearInterval(connectionCheckInterval);
          setConnectionCheckInterval(null);
        }
        
        if (!connectedInstances.has(connection.id)) {
          setConnectedInstances(prev => new Set(prev).add(connection.id));
          toast.success('WhatsApp conectado com sucesso!');
          syncLastConversations(connection);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Erro ao verificar status da conexão:', error);
      return false;
    }
  };

  const handleConnect = async (connection: Connection) => {
    setSelectedConnection(connection);
    setIsQrModalOpen(true);
    setIsConnecting(connection.id);
    setQrCodeData('');

    try {
      await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      const connectResponse = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });

      if (connectResponse?.base64 || connectResponse?.qrcode) {
        setQrCodeData(connectResponse.base64 || connectResponse.qrcode);
        await dbClient.connections.update(connection.id, { status: 'WAITING_QR_CODE' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'WAITING_QR_CODE' } : c
        ));

        const interval = setInterval(() => {
          checkConnectionStatus(connection);
        }, 3000);
        
        setConnectionCheckInterval(interval);
        
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            setConnectionCheckInterval(null);
          }
        }, 300000);
      }

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error('Erro ao iniciar conexão', { description: error.message });
      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
      ));
      setIsQrModalOpen(false);
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (connection: Connection) => {
    try {
      await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_LOGOUT(connection.instance_name), {
        method: 'DELETE',
        suppressToast: true,
      });

      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
      ));
      
      setConnectedInstances(prev => {
        const newSet = new Set(prev);
        newSet.delete(connection.id);
        return newSet;
      });
      
      toast.success('WhatsApp desconectado com sucesso.');
      
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar', { description: error.message });
      await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
      ));
    }
  };

  const handlePause = async (connection: Connection) => {
    try {
      await dbClient.connections.update(connection.id, { status: 'PAUSED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'PAUSED' } : c
      ));
      
      try {
        await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_PAUSE(connection.instance_name), {
          method: 'POST',
          suppressToast: true,
        });
      } catch (apiError) {
        console.warn('API Evolution não suporta pause ou erro:', apiError);
      }
      
      setConnectedInstances(prev => {
        const newSet = new Set(prev);
        newSet.delete(connection.id);
        return newSet;
      });
      
      toast.success('Conexão pausada com sucesso.');
    } catch (error: any) {
      toast.error('Erro ao pausar conexão', { description: error.message });
    }
  };

  const handleResume = async (connection: Connection) => {
    try {
      const statusResponse = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });

      if (statusResponse?.instance?.state === 'open') {
        await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
        ));
        toast.success('Conexão retomada com sucesso.');
      } else {
        await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
        ));
        toast.warning('Conexão foi perdida. Clique em "Conectar" para reconectar.');
      }
    } catch (error: any) {
      toast.error('Erro ao retomar conexão', { description: error.message });
      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
      ));
    }
  };

  const syncLastConversations = async (connection: Connection) => {
    try {
      toast.loading('Sincronizando conversas do WhatsApp...', { id: 'sync-chats' });
      
      const endpoints = [
        API_ENDPOINTS.CHAT_FIND(connection.instance_name),
        `/chat/find/${connection.instance_name}`,
        `/chat/fetchChats/${connection.instance_name}`,
        `/message/findChats/${connection.instance_name}`,
      ];

      let chatsResponse = null;
      
      for (const endpoint of endpoints) {
        try {
          chatsResponse = await evolutionApiRequest<any>(endpoint, {
            method: 'GET',
            suppressToast: true,
          });
          
          if (chatsResponse && (Array.isArray(chatsResponse) || Array.isArray(chatsResponse.data))) {
            console.log(`✅ Chats encontrados usando endpoint: ${endpoint}`);
            break;
          }
        } catch (error) {
          console.warn(`❌ Endpoint ${endpoint} falhou:`, error);
          continue;
        }
      }

      const chats = Array.isArray(chatsResponse) ? chatsResponse : chatsResponse?.data;

      if (chats && Array.isArray(chats)) {
        let syncedCount = 0;
        const recentChats = chats.slice(0, 20);
        
        for (const chat of recentChats) {
          try {
            const remoteJid = chat.id;
            if (!remoteJid || remoteJid.endsWith('@g.us')) continue;
            
            const phone = remoteJid.split('@')[0];
            const contactName = chat.name || chat.pushName || phone;
            
            if (!phone) continue;

            const { data: contact } = await supabase
              .from('contacts')
              .upsert({ 
                user_id: user?.id, 
                phone_number: phone, 
                name: contactName 
              }, { 
                onConflict: 'user_id, phone_number' 
              })
              .select('id')
              .single();

            if (contact) {
              const { data: conversation } = await supabase
                .from('conversations')
                .upsert({ 
                  user_id: user?.id, 
                  contact_id: contact.id, 
                  connection_id: connection.id,
                  status: 'pending' 
                }, { 
                  onConflict: 'user_id, contact_id' 
                })
                .select('id')
                .single();

              if (conversation) {
                syncedCount++;
              }
            }
          } catch (error) {
            console.warn('Erro ao processar chat:', error);
          }
        }
        
        toast.success(`${syncedCount} conversas sincronizadas!`, { id: 'sync-chats' });
        fetchConnections();
      } else {
        toast.warning('Nenhuma conversa encontrada para sincronizar', { id: 'sync-chats' });
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar conversas:', error);
      toast.error('Erro ao sincronizar conversas', { 
        description: error.message,
        id: 'sync-chats' 
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedConnection) return;
    setIsDeleting(true);
    try {
      await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_DELETE(selectedConnection.instance_name), {
        method: 'DELETE',
        suppressToast: true,
      }).catch(e => console.warn("Falha ao deletar na API Evolution:", e.message));

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
      toast.error('Você precisa estar logado para criar uma instância.');
      return;
    }

    setIsCreating(true);

    try {
      const created = await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        instance_data: { 
          created_at: new Date().toISOString(),
          api_created: false 
        },
      });

      setConnections(prev => [created, ...prev]);

      const webhookUrl = `${window.location.origin}/api/whatsapp/webhook?uid=${encodeURIComponent(user.id)}`;

      const createPayload = {
        instanceName: newConnectionName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED', 
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT'
          ]
        }
      };

      try {
        const creationResponse = await evolutionApiRequest<EvolutionInstanceCreateResponse>(API_ENDPOINTS.INSTANCE_CREATE, {
          method: 'POST',
          body: JSON.stringify(createPayload),
          suppressToast: true,
        });

        if (creationResponse && creationResponse.status !== 'error') {
          await dbClient.connections.update(created.id, {
            instance_data: {
              ...creationResponse,
              created_at: new Date().toISOString(),
              api_created: true
            }
          });
          
          toast.success(`Instância "${newConnectionName}" criada com sucesso!`);
        } else {
          toast.warning(`Instância "${newConnectionName}" criada localmente`, { 
            description: 'Não foi possível criar na API Evolution. Você pode tentar conectar manualmente.' 
          });
        }
      } catch (apiError: any) {
        console.warn('Erro ao criar na API Evolution:', apiError.message);
        toast.warning(`Instância "${newConnectionName}" criada localmente`, { 
          description: `Erro na API Evolution: ${apiError.message}` 
        });
      }

      setIsCreateModalOpen(false);
      setNewConnectionName('');

    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast.error('Falha ao criar instância', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const getPhoneNumber = (connection: Connection) => {
    const instanceData = connection.instance_data as any;
    return instanceData?.owner?.split('@')[0] || instanceData?.number || 'Não disponível';
  };

  // Modern connection card component
  const ConnectionCard = ({ connection }: { connection: Connection }) => {
    const status = connection.status;
    const phoneNumber = getPhoneNumber(connection);
    const isLoading = isConnecting === connection.id;

    const getStatusIcon = () => {
      switch (status) {
        case 'CONNECTED':
          return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'DISCONNECTED':
          return <XCircle className="w-5 h-5 text-red-500" />;
        case 'INITIALIZING':
        case 'WAITING_QR_CODE':
          return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
        case 'PAUSED':
          return <AlertCircle className="w-5 h-5 text-orange-500" />;
        default:
          return <XCircle className="w-5 h-5 text-gray-500" />;
      }
    };

    const getStatusText = () => {
      switch (status) {
        case 'CONNECTED':
          return 'Conectado';
        case 'DISCONNECTED':
          return 'Desconectado';
        case 'INITIALIZING':
          return 'Conectando...';
        case 'WAITING_QR_CODE':
          return 'Aguardando QR';
        case 'PAUSED':
          return 'Pausado';
        default:
          return 'Desconhecido';
      }
    };

    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        {/* Header with WhatsApp icon and status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {connection.instance_name}
              </h3>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {getStatusText()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Phone number display */}
        {status === 'CONNECTED' && phoneNumber !== 'Não disponível' && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
              <Phone className="w-4 h-4" />
              <span>Telefone Conectado:</span>
            </div>
            <p className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
              +{phoneNumber}
            </p>
          </div>
        )}

        {/* Status message */}
        <div className="mb-6">
          {status === 'CONNECTED' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sua conexão está ativa e pronta para receber mensagens.
            </p>
          )}
          {status === 'DISCONNECTED' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A sua conta do WhatsApp está offline. Conecte-se para receber e enviar mensagens.
            </p>
          )}
          {status === 'WAITING_QR_CODE' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Escaneie o QR Code com seu WhatsApp para conectar.
            </p>
          )}
          {status === 'INITIALIZING' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Estabelecendo conexão com o WhatsApp...
            </p>
          )}
          {status === 'PAUSED' && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Conexão pausada. Clique em retomar para continuar.
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {status === 'DISCONNECTED' && (
            <Button
              onClick={() => handleConnect(connection)}
              disabled={isLoading}
              loading={isLoading}
              className="bg-green-500 hover:bg-green-600 text-white border-0 flex-1 min-w-[120px]"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Conectar
            </Button>
          )}

          {status === 'WAITING_QR_CODE' && (
            <Button
              onClick={() => {
                setSelectedConnection(connection);
                setIsQrModalOpen(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white border-0 flex-1 min-w-[120px]"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Ver QR Code
            </Button>
          )}

          {status === 'CONNECTED' && (
            <>
              <Button
                onClick={() => handleDisconnect(connection)}
                className="bg-green-500 hover:bg-green-600 text-white border-0 flex-1 min-w-[120px]"
              >
                <WifiOff className="w-4 h-4 mr-2" />
                Desconectar
              </Button>
              <Button
                onClick={() => handlePause(connection)}
                className="bg-orange-500 hover:bg-orange-600 text-white border-0 flex-1 min-w-[120px]"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
            </>
          )}

          {status === 'PAUSED' && (
            <Button
              onClick={() => handleResume(connection)}
              className="bg-blue-500 hover:bg-blue-600 text-white border-0 flex-1 min-w-[120px]"
            >
              <Play className="w-4 h-4 mr-2" />
              Retomar
            </Button>
          )}

          {/* Secondary actions */}
          <div className="flex gap-2 w-full mt-2">
            {status === 'CONNECTED' && (
              <Button
                onClick={() => syncLastConversations(connection)}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 flex-1"
                title="Sincronizar conversas do WhatsApp"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedConnection(connection);
                setIsDeleteDialogOpen(true);
              }}
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Conexão WhatsApp
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Gerencie suas conexões do WhatsApp para começar a atender seus clientes
          </p>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-primary/20" />
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Carregando conexões...</p>
          </div>
        )}

        {/* Empty state - First connection */}
        {!loading && connections.length === 0 && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Conectar o WhatsApp
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                Clique no botão abaixo para gerar um QR Code e conectar seu número.
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0 w-full py-3 text-lg font-semibold"
              >
                <QrCode className="w-5 h-5 mr-2" />
                Criar Instância
              </Button>
            </div>
          </div>
        )}

        {/* Connections grid */}
        {!loading && connections.length > 0 && (
          <div className="space-y-6">
            {/* Header with add button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Gerenciar Conexão
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Conecte sua conta do WhatsApp para começar a atender.
                </p>
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Conexão
              </Button>
            </div>

            {/* Connections grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connections.map((connection) => (
                <ConnectionCard key={connection.id} connection={connection} />
              ))}
            </div>
          </div>
        )}

        {/* Modal de criação */}
        <Modal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          title="Criar Nova Conexão"
          size="md"
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="instanceName" className="font-semibold">
                Nome da Instância
              </Label>
              <Input 
                id="instanceName" 
                value={newConnectionName} 
                onChange={(e) => setNewConnectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                placeholder="ex: vendas_01" 
                className="transition-all duration-200"
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Use apenas letras minúsculas, números e underscores.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button 
                variant="ghost" 
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateInstance} 
                disabled={isCreating}
                loading={isCreating}
                className="bg-blue-500 hover:bg-blue-600 text-white border-0"
              >
                Criar Instância
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de QR Code */}
        <Modal 
          isOpen={isQrModalOpen} 
          onClose={() => {
            setIsQrModalOpen(false);
            if (connectionCheckInterval) {
              clearInterval(connectionCheckInterval);
              setConnectionCheckInterval(null);
            }
          }} 
          title={`Conectar ${selectedConnection?.instance_name}`}
          size="md"
        >
          <div className="space-y-6 text-center">
            {qrCodeData ? (
              <>
                <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                  <img 
                    src={qrCodeData} 
                    alt="QR Code para conectar WhatsApp" 
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Escaneie o QR Code
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Abra o WhatsApp no seu celular, vá em Dispositivos Vinculados e escaneie este código.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    O modal fechará automaticamente quando a conexão for estabelecida.
                  </p>
                </div>
              </>
            ) : (
              <div className="py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  Gerando QR Code...
                </p>
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => {
                setIsQrModalOpen(false);
                if (connectionCheckInterval) {
                  clearInterval(connectionCheckInterval);
                  setConnectionCheckInterval(null);
                }
              }}
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        </Modal>

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
          title="Excluir Conexão"
          description={`Tem certeza que deseja excluir a instância "${selectedConnection?.instance_name}"? Esta ação não pode ser desfeita.`}
          confirmText={isDeleting ? "Excluindo..." : "Excluir"}
          cancelText="Cancelar"
          variant="destructive"
        />
      </div>
    </div>
  );
}