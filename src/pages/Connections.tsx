import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Modal from '@/components/ui/Modal';
import { Plus, Loader2, RefreshCw, Smartphone, Wifi, WifiOff, Pause, Play, Trash2, QrCode, Phone } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { Connection, ConnectionStatus } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import AlertDialog from '@/components/ui/AlertDialog';
import { EvolutionInstanceCreateResponse } from '@/types/evolution-api';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Status colors mapping
const STATUS_COLORS = {
  CONNECTED: 'bg-green-500/10 text-green-700 border-green-200',
  DISCONNECTED: 'bg-red-500/10 text-red-700 border-red-200',
  INITIALIZING: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  WAITING_QR_CODE: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
  PAUSED: 'bg-orange-500/10 text-orange-700 border-orange-200',
} as const;

const STATUS_LABELS = {
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado', 
  INITIALIZING: 'Conectando...',
  WAITING_QR_CODE: 'Aguardando QR',
  PAUSED: 'Pausado',
} as const;

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
      // Limpar intervalo se existir
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
        // Conexão estabelecida
        await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
        ));
        
        // Fechar modal automaticamente
        setIsQrModalOpen(false);
        setSelectedConnection(null);
        
        // Limpar intervalo
        if (connectionCheckInterval) {
          clearInterval(connectionCheckInterval);
          setConnectionCheckInterval(null);
        }
        
        // Mostrar mensagem apenas uma vez por instância
        if (!connectedInstances.has(connection.id)) {
          setConnectedInstances(prev => new Set(prev).add(connection.id));
          toast.success('WhatsApp conectado com sucesso!');
          
          // Sincronizar últimas conversas
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

        // Iniciar monitoramento da conexão
        const interval = setInterval(() => {
          checkConnectionStatus(connection);
        }, 3000); // Verificar a cada 3 segundos
        
        setConnectionCheckInterval(interval);
        
        // Limpar intervalo após 5 minutos (timeout)
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            setConnectionCheckInterval(null);
          }
        }, 300000); // 5 minutos
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
      
      // Remover da lista de instâncias conectadas
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
      // Primeiro pausar no banco local
      await dbClient.connections.update(connection.id, { status: 'PAUSED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'PAUSED' } : c
      ));
      
      // Tentar pausar na API Evolution (se suportado)
      try {
        await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_PAUSE(connection.instance_name), {
          method: 'POST',
          suppressToast: true,
        });
      } catch (apiError) {
        console.warn('API Evolution não suporta pause ou erro:', apiError);
        // Não é crítico se a API não suportar pause
      }
      
      // Remover da lista de instâncias conectadas
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
      // Verificar se a instância ainda está conectada na API Evolution
      const statusResponse = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });

      if (statusResponse?.instance?.state === 'open') {
        // Se ainda está conectada, apenas atualizar status
        await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
        ));
        toast.success('Conexão retomada com sucesso.');
      } else {
        // Se desconectou, precisa reconectar
        await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
        ));
        toast.warning('Conexão foi perdida. Clique em "Conectar" para reconectar.');
      }
    } catch (error: any) {
      toast.error('Erro ao retomar conexão', { description: error.message });
      // Em caso de erro, marcar como desconectado
      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
      ));
    }
  }; 
  const syncLastConversations = async (connection: Connection) => {
    try {
      toast.loading('Sincronizando conversas do WhatsApp...', { id: 'sync-chats' });
      
      // Tentar diferentes endpoints para buscar chats
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

      // Normalizar resposta (alguns endpoints retornam { data: [...] })
      const chats = Array.isArray(chatsResponse) ? chatsResponse : chatsResponse?.data;

      if (chats && Array.isArray(chats)) {
        let syncedCount = 0;
        
        // Processar últimas 20 conversas
        const recentChats = chats.slice(0, 20);
        
        for (const chat of recentChats) {
          try {
            // Extrair número do telefone
            const remoteJid = chat.id;
            if (!remoteJid || remoteJid.endsWith('@g.us')) continue; // Pular grupos
            
            const phone = remoteJid.split('@')[0];
            const contactName = chat.name || chat.pushName || phone;
            
            if (!phone) continue;

            // Criar/atualizar contato
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
              // Criar conversa como pendente
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
                // Tentar buscar mensagens recentes desta conversa
                try {
                  const messagesResponse = await evolutionApiRequest<any>(`/chat/findMessages/${connection.instance_name}`, {
                    method: 'POST',
                    body: JSON.stringify({
                      where: {
                        key: {
                          remoteJid: remoteJid
                        }
                      },
                      limit: 5 // Últimas 5 mensagens
                    }),
                    suppressToast: true,
                  });

                  if (messagesResponse && Array.isArray(messagesResponse)) {
                    for (const msg of messagesResponse.reverse()) { // Ordem cronológica
                      try {
                        const messageContent = msg.message?.conversation || 
                                             msg.message?.extendedTextMessage?.text || 
                                             'Mensagem não suportada';
                        
                        await supabase.from('messages').insert({
                          id: msg.key?.id || crypto.randomUUID(),
                          conversation_id: conversation.id,
                          user_id: user?.id,
                          sender_is_user: msg.key?.fromMe || false,
                          content: messageContent,
                          message_type: 'text',
                          created_at: new Date(msg.messageTimestamp * 1000).toISOString()
                        });
                      } catch (msgError) {
                        console.warn('Erro ao inserir mensagem:', msgError);
                      }
                    }
                  }
                } catch (msgError) {
                  console.warn('Erro ao buscar mensagens:', msgError);
                }
                
                syncedCount++;
              }
            }
          } catch (error) {
            console.warn('Erro ao processar chat:', error);
          }
        }
        
        toast.success(`${syncedCount} conversas sincronizadas!`, { id: 'sync-chats' });
        
        // Atualizar lista de conversas
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
      // Primeiro criar no banco local com status DISCONNECTED
      const created = await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        instance_data: { 
          created_at: new Date().toISOString(),
          api_created: false 
        },
      });

      setConnections(prev => [created, ...prev]);

      // Tentar criar na API Evolution em background
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
          // Atualizar com dados da API Evolution
          await dbClient.connections.update(created.id, {
            instance_data: {
              ...creationResponse,
              created_at: new Date().toISOString(),
              api_created: true
            }
          });
          
          toast.success(`Instância "${newConnectionName}" criada com sucesso no manager da API Evolution.`);
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

  // Modern horizontal connection card component
  const ConnectionCard = ({ connection }: { connection: Connection }) => {
    const status = connection.status;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.DISCONNECTED;
    const statusLabel = STATUS_LABELS[status] || 'Desconhecido';
    const phoneNumber = getPhoneNumber(connection);
    const isLoading = isConnecting === connection.id;

    return (
      <div className={cn(
        "group relative overflow-hidden",
        "bg-gradient-to-r from-white via-white to-slate-50/50",
        "dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50",
        "border border-slate-200/60 dark:border-slate-700/60",
        "rounded-2xl shadow-sm hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.02] hover:-translate-y-1",
        "p-6"
      )}>
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Content container - horizontal layout */}
        <div className="relative flex items-center justify-between gap-4">
          {/* Left side - Instance info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Icon with status indicator */}
            <div className="relative flex-shrink-0">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-primary/10 to-primary/20",
                "border border-primary/20"
              )}>
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              {/* Status indicator dot */}
              <div className={cn(
                "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900",
                status === 'CONNECTED' && "bg-green-500",
                status === 'DISCONNECTED' && "bg-red-500",
                status === 'INITIALIZING' && "bg-yellow-500 animate-pulse",
                status === 'WAITING_QR_CODE' && "bg-yellow-500 animate-pulse",
                status === 'PAUSED' && "bg-orange-500"
              )} />
            </div>

            {/* Instance details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {connection.instance_name}
                </h3>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium border",
                  statusColor
                )}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4" />
                <span>{phoneNumber}</span>
              </div>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'DISCONNECTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleConnect(connection)}
                disabled={isLoading}
                loading={isLoading}
                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200 hover:border-yellow-300"
              >
                <Wifi className="w-4 h-4" />
                Conectar
              </Button>
            )}

            {status === 'WAITING_QR_CODE' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedConnection(connection);
                  setIsQrModalOpen(true);
                }}
                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200 hover:border-yellow-300"
              >
                <QrCode className="w-4 h-4" />
                Ver QR
              </Button>
            )}

            {status === 'CONNECTED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncLastConversations(connection)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300"
                  title="Sincronizar conversas do WhatsApp"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePause(connection)}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 hover:border-orange-300"
                >
                  <Pause className="w-4 h-4" />
                  Pausar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDisconnect(connection)}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                >
                  <WifiOff className="w-4 h-4" />
                  Desconectar
                </Button>
              </>
            )}

            {status === 'PAUSED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResume(connection)}
                className="bg-blue-900 hover:bg-blue-800 text-white border-blue-900 hover:border-blue-800"
              >
                <Play className="w-4 h-4" />
                Retomar
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedConnection(connection);
                setIsDeleteDialogOpen(true);
              }}
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </Button>
          </div>
        </div>
      </div>
    );
  }; 
 return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header moderno e compacto */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Conexões WhatsApp
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gerencie suas instâncias de forma simples e eficiente
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConnections}
                disabled={loading}
                loading={loading}
                icon={RefreshCw}
              >
                Atualizar
              </Button>
              
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                icon={Plus}
              >
                Nova Conexão
              </Button>
            </div>
          </div>
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

        {/* Empty state */}
        {!loading && connections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mb-6">
              <Smartphone className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Nenhuma conexão encontrada
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-center max-w-md">
              Comece criando sua primeira instância do WhatsApp para gerenciar seus atendimentos.
            </p>
            <Button
              variant="gradient"
              onClick={() => setIsCreateModalOpen(true)}
              icon={Plus}
            >
              Criar Primeira Conexão
            </Button>
          </div>
        )}

        {/* Connections grid */}
        {!loading && connections.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {connections.length} {connections.length === 1 ? 'conexão' : 'conexões'}
              </p>
              
              {/* Status summary */}
              <div className="flex items-center gap-2">
                {Object.entries(
                  connections.reduce((acc, conn) => {
                    acc[conn.status] = (acc[conn.status] || 0) + 1;
                    return acc;
                  }, {} as Record<ConnectionStatus, number>)
                ).map(([status, count]) => (
                  <div
                    key={status}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      STATUS_COLORS[status as ConnectionStatus]
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      status === 'CONNECTED' && "bg-green-500",
                      status === 'DISCONNECTED' && "bg-red-500",
                      status === 'INITIALIZING' && "bg-yellow-500",
                      status === 'WAITING_QR_CODE' && "bg-yellow-500",
                      status === 'PAUSED' && "bg-orange-500"
                    )} />
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards grid - layout vertical para cartões horizontais */}
            <div className="space-y-4">
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
                variant="gradient"
                onClick={handleCreateInstance} 
                disabled={isCreating}
                loading={isCreating}
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