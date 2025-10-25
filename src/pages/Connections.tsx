import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Modal from '@/components/ui/Modal';
import ConnectionCard from '@/components/ui/ConnectionCard';
import { Plus, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { Connection, ConnectionStatus } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';
import AlertDialog from '@/components/ui/AlertDialog';
import { EvolutionInstanceCreateResponse, STATUS_CONFIG } from '@/types/evolution-api';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';


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

  // Fecha automaticamente o modal de QR quando a instância conectar e atualiza status
  useEffect(() => {
    if (!isQrModalOpen || !selectedConnection) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const statusRes = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(selectedConnection.instance_name), {
          method: 'GET',
          suppressToast: true,
        });

        const instancesArr = Array.isArray(statusRes?.instances) ? statusRes.instances : null;
        const inst = instancesArr
          ? (instancesArr.find((x: any) => x?.instance?.instanceName === selectedConnection.instance_name) || instancesArr[0])
          : (statusRes?.instance || statusRes);

        const stateCandidates = [
          inst?.state,
          inst?.status,
          inst?.connectionState,
          inst?.session?.state,
          inst?.session?.status,
          statusRes?.state,
          statusRes?.status,
        ];
        const stateLower = String(stateCandidates.find(Boolean) || '').toLowerCase();
        const isConnectedFlag = Boolean(
          inst?.isConnected || inst?.connected || inst?.session?.isConnected ||
          statusRes?.isConnected || statusRes?.connected
        );
        const isConnected = isConnectedFlag || stateLower === 'open' || stateLower === 'connected';

        if (isConnected && !cancelled) {
          const ownerRaw = inst?.owner || inst?.session?.owner || inst?.instance?.owner || statusRes?.owner;
          const chatId = typeof ownerRaw === 'string' ? ownerRaw : (ownerRaw?.wid?.id || ownerRaw?.id || '');
          const number = chatId ? chatId.split('@')[0] : undefined;
          const profileName = [
            inst?.session?.pushName,
            inst?.pushName,
            inst?.name,
            statusRes?.session?.pushName,
            statusRes?.pushName,
            (selectedConnection.instance_data as any)?.profileName,
          ].find(Boolean);

          const updatedData = {
            ...(selectedConnection.instance_data as any),
            owner: chatId || (selectedConnection.instance_data as any)?.owner,
            number,
            profileName,
            connectedAt: new Date().toISOString(),
          };

          try {
            const updated = await dbClient.connections.update(selectedConnection.id, { status: 'CONNECTED', instance_data: updatedData });
            setConnections(prev => prev.map(c => c.id === updated.id ? updated : c));
          } catch {}

          setIsQrModalOpen(false);
          toast.success('Instância conectada com sucesso.');
        }
      } catch {}
    };

    const timer = setInterval(poll, 2000);
    poll();
    return () => { cancelled = true; clearInterval(timer); };
  }, [isQrModalOpen, selectedConnection, evolutionApiRequest]);

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

      let qr = res?.base64 || res?.qrcode || res?.qrCode;
      const pairing = res?.pairingCode || res?.code;

      // Fallback: buscar QR no endpoint dedicado caso não venha na resposta do connect
      if (!qr) {
        const qrRes = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_QR_CODE(connection.instance_name), {
          method: 'GET',
          suppressToast: true,
        });
        qr = qrRes?.base64 || qrRes?.qrcode || qrRes?.qrCode || qr;
      }

      if (qr) setQrCodeData(qr);
      if (pairing) setPairingCode(pairing);

      if (!qr && !pairing) {
        toast.warning('QR Code não recebido. A instância pode já estar conectando.');
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
        method: 'DELETE',
        suppressToast: true,
      });
      toast.success('Comando de desconexão enviado.');
    } catch (error: any) {
      toast.error('Erro ao desconectar', { description: error.message });
    }
  };

  const handlePause = async (connection: Connection) => {
    try {
      // Ajusta configurações para reduzir atividade
      await evolutionApiRequest<any>(API_ENDPOINTS.SETTINGS_SET(connection.instance_name), {
        method: 'POST',
        body: JSON.stringify({
          reject_call: false,
          groups_ignore: true,
          always_online: false,
          read_messages: false,
          read_status: false,
          sync_full_history: false,
        }),
        suppressToast: true,
      });

      // Desabilita webhook para pausar entrega de eventos ao backend
      let finalWebhookUrl = webhookUrlEnv;
      if (!finalWebhookUrl) {
        if (backendUrl) {
          const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
          finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
        } else {
          finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
        }
      }
      const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user!.id)}`;
      await evolutionApiRequest<any>(API_ENDPOINTS.WEBHOOK_SET(connection.instance_name), {
        method: 'POST',
        body: JSON.stringify({
          url: webhookWithUid,
          events: [],
          webhook_by_events: false,
          webhook_base64: false,
          enabled: false,
        }),
        suppressToast: true,
      }).catch(() => {});

      toast.success('Conexão pausada. Webhook desativado.');
      await dbClient.connections.update(connection.id, { status: 'PAUSED' });
    } catch (error: any) {
      toast.error('Erro ao pausar conexão', { description: error.message });
    }
  };

  const handleResume = async (connection: Connection) => {
    try {
      // Reativa configurações
      await evolutionApiRequest<any>(API_ENDPOINTS.SETTINGS_SET(connection.instance_name), {
        method: 'POST',
        body: JSON.stringify({
          reject_call: false,
          groups_ignore: true,
          always_online: true,
          read_messages: true,
          read_status: true,
          sync_full_history: false,
        }),
        suppressToast: true,
      });

      // Reabilita webhook
      let finalWebhookUrl = webhookUrlEnv;
      if (!finalWebhookUrl) {
        if (backendUrl) {
          const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
          finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
        } else {
          finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
        }
      }
      const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user!.id)}`;
      await evolutionApiRequest<any>(API_ENDPOINTS.WEBHOOK_SET(connection.instance_name), {
        method: 'POST',
        body: JSON.stringify({
          url: webhookWithUid,
          webhook_by_events: true,
          webhook_base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT'
          ],
        }),
        suppressToast: true,
      });

      // Consulta estado atual e ajusta status local
      const statusRes = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name), {
        method: 'GET',
        suppressToast: true,
      });
      const state = String(statusRes?.state || statusRes?.status || statusRes?.connectionState || '').toLowerCase();
      const connected = state === 'open' || state === 'connected' || Boolean(statusRes?.connected || statusRes?.isConnected);
      await dbClient.connections.update(connection.id, { status: connected ? 'CONNECTED' : 'DISCONNECTED' });

      toast.success('Conexão retomada. Webhook reativado.');
    } catch (error: any) {
      toast.error('Erro ao retomar conexão', { description: error.message });
    }
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
      toast.error('Você precisa estar logado para criar uma instância.');
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
      toast.error('Configuração Incompleta', { description: 'A URL do webhook não pôde ser determinada. Verifique VITE_BACKEND_URL ou VITE_EVOLUTION_WEBHOOK_URL no seu arquivo .env.' });
      setIsCreating(false);
      return;
    }
    
    try {
      // Anexa uid ao webhook para identificar o usuário no backend
      const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user.id)}`;

      const createPayload: any = {
        instanceName: newConnectionName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: webhookWithUid,
        webhook_by_events: true,
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT'
        ],
        // Configurações padrão recomendadas para v1
        reject_call: false,
        msg_call: '',
        groups_ignore: true,
        always_online: true,
        read_messages: true,
        read_status: true,
        sync_full_history: false,
      };

      // Tenta múltiplos endpoints de criação para compatibilidade com diferentes versões da Evolution API
      const createEndpoints = [
        API_ENDPOINTS.INSTANCE_CREATE,
        '/instances/create',
        '/v1/instance/create',
        '/v1/instances/create',
      ];

      let creationResponse: EvolutionInstanceCreateResponse | null = null;
      for (const ep of createEndpoints) {
        try {
          const res = await evolutionApiRequest<EvolutionInstanceCreateResponse>(ep, {
            method: 'POST',
            body: JSON.stringify(createPayload),
            suppressToast: true,
          });
          if (res) { creationResponse = res; break; }
        } catch (e) {
          // segue para o próximo endpoint
        }
      }

      if (!creationResponse || (creationResponse.status === 'error' && creationResponse.message)) {
        throw new Error(creationResponse?.message || 'A API Evolution não respondeu à criação da instância. Verifique se a URL da API está correta e acessível.');
      }

      const created = await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        instance_data: creationResponse,
      });

      // Atualiza lista local imediatamente para refletir o botão "Conectar"
      setConnections(prev => [created, ...prev]);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Modern page container with enhanced responsive spacing */}
      <div className={cn(
        "container mx-auto space-y-6 sm:space-y-8 lg:space-y-10",
        // Enhanced responsive padding for better mobile experience
        "px-4 sm:px-6 lg:px-8 xl:px-12",
        // Improved vertical spacing with better mobile optimization
        "py-6 sm:py-8 lg:py-12 xl:py-16",
        // Enhanced maximum width constraints for ultra-wide screens
        "max-w-7xl 2xl:max-w-screen-2xl"
      )}>
        
        {/* Modern page header with enhanced typography and professional layout */}
        <header className={cn(
          "flex flex-col gap-6 sm:gap-8 lg:gap-10",
          // Enhanced responsive layout with better visual hierarchy
          "sm:flex-row sm:items-start sm:justify-between",
          "lg:items-center",
          // Improved spacing and visual separation
          "pb-2 border-b border-border/30"
        )}>
          {/* Enhanced title section with modern typography hierarchy */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-5">
            <div className="space-y-2">
              {/* Modern page title with enhanced typography */}
              <h1 className={cn(
                // Enhanced responsive typography with better scaling
                "typography-responsive-display",
                "font-bold tracking-tight",
                // Professional gradient text effect
                "bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70",
                "bg-clip-text text-transparent",
                // Better line height and spacing
                "leading-[1.1] sm:leading-[1.05]",
                // Enhanced mobile optimization
                "text-3xl sm:text-4xl lg:text-5xl xl:text-6xl"
              )}>
                Gerenciar Conexões
              </h1>
              
              {/* Enhanced subtitle with better visual hierarchy */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={cn(
                  "h-1 w-12 sm:w-16 lg:w-20",
                  "bg-gradient-to-r from-primary-500 to-primary-600",
                  "rounded-full"
                )} />
                <span className={cn(
                  "typography-caption uppercase tracking-wider",
                  "text-primary-600 font-semibold"
                )}>
                  WhatsApp Multi-Atendimento
                </span>
              </div>
            </div>
            
            {/* Enhanced description with better readability */}
            <p className={cn(
              "typography-body-lg text-muted-foreground",
              "max-w-2xl leading-relaxed",
              // Better responsive text sizing
              "text-base sm:text-lg lg:text-xl",
              // Enhanced line height for readability
              "leading-7 sm:leading-8"
            )}>
              Gerencie suas instâncias do WhatsApp de forma profissional e intuitiva. 
              Conecte múltiplas contas e centralize todos os seus atendimentos.
            </p>
          </div>
          
          {/* Enhanced action buttons with modern styling and improved UX */}
          <div className={cn(
            "flex items-center gap-3 sm:gap-4",
            // Enhanced responsive layout with better mobile experience
            "w-full sm:w-auto",
            "flex-col xs:flex-row sm:flex-row",
            // Better alignment and spacing
            "sm:shrink-0 sm:self-start lg:self-center"
          )}>
            {/* Enhanced refresh button with modern styling */}
            <Button 
              variant="outline" 
              size="default"
              onClick={fetchConnections} 
              disabled={loading}
              loading={loading}
              icon={RefreshCw}
              className={cn(
                // Enhanced base styling with better transitions
                "transition-all duration-300 ease-out",
                // Better mobile touch targets
                "w-full xs:w-auto sm:w-auto",
                "min-h-[44px] sm:min-h-[42px] lg:min-h-[44px]",
                // Enhanced hover and focus states
                "hover:border-primary/60 hover:bg-primary/8 hover:text-primary-700",
                "hover:shadow-md hover:scale-[1.02]",
                "active:scale-[0.98] active:shadow-sm",
                // Better focus accessibility
                "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                // Enhanced loading state
                loading && "animate-pulse border-primary/40 bg-primary/5",
                // Improved disabled state
                "disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:border-input"
              )}
              aria-label={loading ? "Atualizando lista de conexões..." : "Atualizar lista de conexões"}
            >
              {/* Enhanced responsive text with better hierarchy */}
              <span className="hidden sm:inline lg:hidden xl:inline font-medium">
                {loading ? "Atualizando..." : "Atualizar"}
              </span>
              <span className="sm:hidden lg:inline xl:hidden font-medium">
                {loading ? "Carregando..." : "Refresh"}
              </span>
              <span className="xs:hidden font-medium">
                {loading ? "Atualizando Lista..." : "Atualizar Lista"}
              </span>
            </Button>
            
            {/* Enhanced create button with gradient styling */}
            <Button 
              variant="gradient" 
              size="default"
              onClick={() => setIsCreateModalOpen(true)}
              icon={Plus}
              className={cn(
                // Enhanced gradient styling with better shadows
                "shadow-lg hover:shadow-xl hover:shadow-primary/25",
                // Better mobile touch targets
                "w-full xs:w-auto sm:w-auto",
                "min-h-[44px] sm:min-h-[42px] lg:min-h-[44px]",
                // Enhanced hover and interaction states
                "hover:scale-[1.03] hover:-translate-y-0.5",
                "active:scale-[0.97] active:translate-y-0",
                "transition-all duration-300 ease-out",
                // Enhanced focus accessibility
                "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                // Better gradient hover effects
                "hover:from-primary-600 hover:to-primary-700",
                // Enhanced text styling
                "font-semibold tracking-wide"
              )}
              aria-label="Criar nova conexão WhatsApp"
            >
              {/* Enhanced responsive text with better visual hierarchy */}
              <span className="hidden sm:inline lg:hidden xl:inline">
                Nova Conexão
              </span>
              <span className="sm:hidden lg:inline xl:hidden">
                Nova
              </span>
              <span className="xs:hidden">
                Criar Nova Conexão
              </span>
            </Button>
          </div>
        </header>

        {/* Enhanced main content area with improved spacing */}
        <main className="space-y-6 sm:space-y-8">
          {/* Enhanced loading state with modern spinner and better animation */}
          {loading && (
            <div className={cn(
              "flex flex-col items-center justify-center",
              "py-16 sm:py-20 lg:py-24 space-y-6"
            )}>
              <div className="relative">
                <Loader2 className="h-12 w-12 sm:h-14 sm:w-14 animate-spin text-primary" />
                <div className="absolute inset-0 h-12 w-12 sm:h-14 sm:w-14 animate-ping rounded-full bg-primary/20" />
                <div className="absolute inset-2 h-8 w-8 sm:h-10 sm:w-10 animate-pulse rounded-full bg-primary/10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">Carregando conexões</p>
                <p className="text-sm text-muted-foreground">Aguarde um momento...</p>
              </div>
            </div>
          )}

          {/* Enhanced professional empty state with improved design */}
          {!loading && connections.length === 0 && (
            <div className={cn(
              "flex flex-col items-center justify-center",
              "py-16 sm:py-20 lg:py-24 px-6 sm:px-8"
            )}>
              {/* Enhanced visual element with better gradients */}
              <div className="relative mb-8 sm:mb-10">
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5",
                  "rounded-full blur-2xl scale-150"
                )} />
                <div className={cn(
                  "relative bg-gradient-to-br from-card via-card to-card/80",
                  "rounded-3xl p-8 sm:p-10 lg:p-12",
                  "border border-border/50 shadow-xl",
                  "backdrop-blur-sm"
                )}>
                  <div className="relative">
                    <AlertTriangle className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground/60 mx-auto" />
                    <div className={cn(
                      "absolute inset-0 h-16 w-16 sm:h-20 sm:w-20 mx-auto",
                      "bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl"
                    )} />
                  </div>
                </div>
              </div>
              
              {/* Enhanced content with better typography */}
              <div className="text-center space-y-6 max-w-lg">
                <div className="space-y-3">
                  <h3 className={cn(
                    "text-2xl sm:text-3xl font-bold",
                    "bg-gradient-to-r from-foreground to-foreground/80",
                    "bg-clip-text text-transparent"
                  )}>
                    Nenhuma conexão encontrada
                  </h3>
                  <p className={cn(
                    "text-base sm:text-lg text-muted-foreground leading-relaxed",
                    "max-w-md mx-auto"
                  )}>
                    Comece criando sua primeira instância do WhatsApp para gerenciar seus atendimentos de forma profissional.
                  </p>
                </div>
                
                {/* Enhanced call-to-action with better styling */}
                <div className="pt-4">
                  <Button 
                    variant="gradient" 
                    size="lg"
                    onClick={() => setIsCreateModalOpen(true)}
                    icon={Plus}
                    className={cn(
                      "shadow-xl hover:shadow-2xl",
                      "hover:scale-[1.05] active:scale-[0.95]",
                      "transition-all duration-300"
                    )}
                  >
                    Criar Primeira Conexão
                  </Button>
                </div>
                
                {/* Additional helpful information */}
                <div className={cn(
                  "pt-6 border-t border-border/30",
                  "text-sm text-muted-foreground/80"
                )}>
                  <p>Conecte múltiplas instâncias e gerencie todos os seus atendimentos em um só lugar</p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced responsive connections grid with optimized layout */}
          {!loading && connections.length > 0 && (
            <div className="space-y-6">
              {/* Grid header with connection count and filters */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {connections.length} {connections.length === 1 ? 'conexão' : 'conexões'} encontrada{connections.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              
              {/* Enhanced responsive grid with optimized breakpoints and spacing */}
              <div className={cn(
                "grid auto-rows-fr",
                // Mobile (320px - 474px): Single column with optimal spacing
                "grid-cols-1 gap-4",
                // Small mobile (475px - 639px): Single column with increased spacing
                "xs:grid-cols-1 xs:gap-5",
                // Tablet portrait (640px - 767px): 2 columns with comfortable spacing
                "sm:grid-cols-2 sm:gap-6",
                // Tablet landscape (768px - 1023px): 2 columns with enhanced spacing
                "md:grid-cols-2 md:gap-6",
                // Desktop (1024px - 1279px): 3 columns for optimal viewing
                "lg:grid-cols-3 lg:gap-7",
                // Large desktop (1280px - 1535px): 3 columns with premium spacing
                "xl:grid-cols-3 xl:gap-8",
                // Extra large (1536px - 1599px): 4 columns for wide screens
                "2xl:grid-cols-4 2xl:gap-8",
                // Ultra-wide (1600px+): 4-5 columns with maximum spacing
                "3xl:grid-cols-5 3xl:gap-10",
                // Ensure consistent card heights across rows
                "items-stretch"
              )}>
                {connections.map((connection) => {
                  const uiStatus: UiStatus = normalizeStatus(connection.status);
                  const isSelectedAndConnecting = isConnecting === connection.id;

                  return (
                    <div
                      key={connection.id}
                      className={cn(
                        "group relative",
                        // Enhanced mobile touch targets with optimized sizing
                        "min-h-[280px] sm:min-h-[300px] lg:min-h-[320px]",
                        // Touch-friendly interactions with improved feedback
                        "touch-manipulation select-none",
                        // Enhanced responsive behavior with better performance
                        "transform-gpu transition-all duration-300 ease-out",
                        // Improved hover states for desktop with better z-index management
                        "hover:z-10 transition-all duration-300 ease-out",
                        // Enhanced focus management for keyboard navigation
                        "focus-within:z-20",
                        // Better animation performance
                        "will-change-transform"
                      )}
                    >
                      <ConnectionCard
                        instanceName={connection.instance_name}
                        phoneNumber={getPhoneNumber(connection)}
                        status={uiStatus}
                        isLoading={isSelectedAndConnecting || apiLoading}
                        onConnect={() => handleConnect(connection)}
                        onDisconnect={() => handleDisconnect(connection)}
                        onPause={() => handlePause(connection)}
                        onResume={() => handleResume(connection)}
                        onShowQR={() => handleConnect(connection)}
                        onDelete={() => {
                          setSelectedConnection(connection);
                          setIsDeleteDialogOpen(true);
                        }}
                        className={cn(
                          "h-full w-full",
                          // Enhanced mobile interactions with better touch feedback
                          "touch-manipulation",
                          // Improved responsive behavior with smoother animations
                          "transition-all duration-300 ease-out",
                          // Enhanced hover states with better visual feedback
                          "hover:z-10 hover:scale-[1.02] hover:-translate-y-1",
                          "hover:shadow-xl",
                          // Enhanced focus states for better accessibility
                          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2",
                          "focus-within:ring-offset-background",
                          // Mobile-specific optimizations with better feedback
                          "active:scale-[0.98] active:translate-y-0",
                          // Enhanced reduced motion support
                          "motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0",
                          "motion-reduce:active:scale-100 motion-reduce:transition-none"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Criar Nova Conexão"
        variant="elevated"
        size="md"
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="instanceName" className="typography-body font-semibold">
              Nome da Instância
            </Label>
            <Input 
              id="instanceName" 
              value={newConnectionName} 
              onChange={(e) => setNewConnectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
              placeholder="ex: vendas_01" 
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="typography-body-sm text-muted-foreground leading-relaxed">
              Use apenas letras minúsculas, números e underscores para identificar sua instância.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
            <Button 
              variant="ghost" 
              onClick={() => setIsCreateModalOpen(false)}
              className="hover:bg-muted/50"
            >
              Cancelar
            </Button>
            <Button 
              variant="gradient"
              onClick={handleCreateInstance} 
              disabled={isCreating}
              loading={isCreating}
              className="shadow-lg hover:shadow-xl min-w-[140px]"
            >
              Criar Instância
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isQrModalOpen} 
        onClose={() => setIsQrModalOpen(false)} 
        title="Conectar WhatsApp"
        variant="glass"
        size="lg"
      >
        <div className="space-y-6">
          {/* Instance info header */}
          <div className="text-center p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
            <p className="typography-body-sm text-muted-foreground">
              Conectando instância
            </p>
            <p className="typography-h4 font-semibold text-foreground mt-1">
              {selectedConnection?.instance_name}
            </p>
          </div>

          {/* QR Code / Pairing content */}
          <div className="flex flex-col items-center justify-center space-y-6 min-h-[320px]">
            {(isConnecting || apiLoading) && !qrCodeData && !pairingCode ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <div className="absolute inset-0 h-16 w-16 animate-ping rounded-full bg-primary/20" />
                </div>
                <div className="text-center space-y-2">
                  <p className="typography-body font-medium">Gerando QR Code...</p>
                  <p className="typography-body-sm text-muted-foreground">
                    Aguarde enquanto preparamos sua conexão
                  </p>
                </div>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-6 bg-white rounded-2xl shadow-lg border border-border/50">
                    <img 
                      src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`} 
                      alt="QR Code para conectar WhatsApp" 
                      className="w-64 h-64 rounded-lg"
                    />
                  </div>
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="typography-body font-medium">Escaneie com o WhatsApp</p>
                  <p className="typography-body-sm text-muted-foreground leading-relaxed">
                    Abra o WhatsApp, vá em <strong>Dispositivos conectados</strong> e escaneie este código
                  </p>
                </div>
              </div>
            ) : pairingCode ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-success/20 to-success/10 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-8 bg-gradient-to-br from-card to-card/80 rounded-2xl shadow-lg border border-border/50 text-center">
                    <p className="typography-body font-semibold text-muted-foreground mb-3">
                      Código de Pareamento
                    </p>
                    <p className="typography-display text-4xl font-bold tracking-wider text-foreground font-mono">
                      {pairingCode}
                    </p>
                  </div>
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="typography-body font-medium">Digite no WhatsApp</p>
                  <p className="typography-body-sm text-muted-foreground leading-relaxed">
                    Insira este código no WhatsApp para parear sua instância
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-r from-destructive/20 to-destructive/10 rounded-2xl blur-xl opacity-75" />
                  <div className="relative p-6 bg-gradient-to-br from-card to-card/80 rounded-2xl border border-destructive/20">
                    <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
                  </div>
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="typography-body font-medium text-destructive">Erro ao gerar QR Code</p>
                  <p className="typography-body-sm text-muted-foreground leading-relaxed">
                    Não foi possível obter o código. Verifique as configurações da API e tente novamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
            <Button 
              variant="outline" 
              onClick={() => setIsQrModalOpen(false)}
              className="hover:bg-muted/50"
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      <AlertDialog 
        isOpen={isDeleteDialogOpen} 
        onClose={() => setIsDeleteDialogOpen(false)} 
        onConfirm={confirmDelete} 
        title="Confirmar Exclusão" 
        description={`Tem certeza que deseja excluir a instância "${selectedConnection?.instance_name}"? Esta ação não pode ser desfeita.`} 
        confirmText="Excluir" 
        isConfirming={isDeleting}
        variant="destructive"
      />
    </div>
  );
}
