import React, { useState, useEffect, useCallback } from 'react';
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
import { SkipLink, useStatusAnnouncer, AccessibleHeading, useGridNavigation, AccessibilityProvider } from '@/components/ui/AccessibilityUtils';
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
  
  // Accessibility announcements
  const { announce, LiveRegionComponent } = useStatusAnnouncer();
  
  // Grid navigation for keyboard users
  const gridRef = React.useRef<HTMLDivElement>(null);
  const { handleKeyDown: handleGridKeyDown, focusItem } = useGridNavigation(gridRef, {
    columns: 3, // Default desktop columns
    wrap: true,
    onActivate: (index) => {
      // Activate the primary action of the focused card
      const cards = gridRef.current?.querySelectorAll('[role="gridcell"]');
      const card = cards?.[index];
      const primaryButton = card?.querySelector('[data-primary-action="true"]') as HTMLButtonElement;
      if (primaryButton && !primaryButton.disabled) {
        primaryButton.click();
      }
    }
  });

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

  // Polling para verificar conexão e fechar modal automaticamente
  useEffect(() => {
    if (!isQrModalOpen || !selectedConnection) return;
    
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 150; // 5 minutos (150 * 2s)

    const poll = async () => {
      if (cancelled || pollCount >= maxPolls) return;
      
      pollCount++;
      
      try {
        // Tentar múltiplos endpoints de status para compatibilidade
        const statusEndpoints = [
          API_ENDPOINTS.INSTANCE_STATUS(selectedConnection.instance_name),
          `/instance/connectionState/${selectedConnection.instance_name}`,
          `/instance/status/${selectedConnection.instance_name}`,
          `/v1/instance/connectionState/${selectedConnection.instance_name}`,
        ];

        let statusRes: any = null;
        
        for (const endpoint of statusEndpoints) {
          try {
            const res = await evolutionApiRequest<any>(endpoint, {
              method: 'GET',
              suppressToast: true,
            });
            
            if (res) {
              statusRes = res;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!statusRes) return;

        // Extrair informações de status de diferentes formatos de resposta
        const instancesArr = Array.isArray(statusRes?.instances) ? statusRes.instances : null;
        const inst = instancesArr
          ? (instancesArr.find((x: any) => x?.instance?.instanceName === selectedConnection.instance_name) || instancesArr[0])
          : (statusRes?.instance || statusRes);

        // Verificar múltiplas propriedades de estado
        const stateCandidates = [
          inst?.state,
          inst?.status,
          inst?.connectionState,
          inst?.session?.state,
          inst?.session?.status,
          statusRes?.state,
          statusRes?.status,
          statusRes?.connectionState,
        ];
        
        const stateLower = String(stateCandidates.find(Boolean) || '').toLowerCase();
        
        // Verificar múltiplas propriedades de conexão
        const isConnectedFlag = Boolean(
          inst?.isConnected || 
          inst?.connected || 
          inst?.session?.isConnected ||
          statusRes?.isConnected || 
          statusRes?.connected ||
          statusRes?.session?.isConnected
        );
        
        const isConnected = isConnectedFlag || 
                           stateLower === 'open' || 
                           stateLower === 'connected' ||
                           stateLower === 'ready';

        if (isConnected && !cancelled) {
          // Extrair informações do proprietário/número
          const ownerRaw = inst?.owner || 
                           inst?.session?.owner || 
                           inst?.instance?.owner || 
                           statusRes?.owner ||
                           statusRes?.session?.owner;
                           
          const chatId = typeof ownerRaw === 'string' ? ownerRaw : 
                        (ownerRaw?.wid?.id || ownerRaw?.id || ownerRaw?._serialized || '');
          const number = chatId ? chatId.split('@')[0] : undefined;
          
          // Extrair nome do perfil
          const profileName = [
            inst?.session?.pushName,
            inst?.pushName,
            inst?.name,
            statusRes?.session?.pushName,
            statusRes?.pushName,
            statusRes?.profileName,
            (selectedConnection.instance_data as any)?.profileName,
          ].find(Boolean);

          // Preparar dados atualizados
          const updatedData = {
            ...(selectedConnection.instance_data as any),
            owner: chatId || (selectedConnection.instance_data as any)?.owner,
            number,
            profileName,
            connectedAt: new Date().toISOString(),
            lastStatusCheck: new Date().toISOString(),
            api_connected: true,
          };

          try {
            // Atualizar no banco de dados
            const updated = await dbClient.connections.update(selectedConnection.id, { 
              status: 'CONNECTED', 
              instance_data: updatedData 
            });
            
            // Atualizar estado local
            setConnections(prev => prev.map(c => c.id === updated.id ? updated : c));
            
            // Fechar modal e mostrar sucesso
            setIsQrModalOpen(false);
            toast.success('WhatsApp conectado com sucesso!', {
              description: profileName ? `Conectado como: ${profileName}` : `Número: ${number || 'N/A'}`
            });
            
            announce(`WhatsApp conectado com sucesso para ${selectedConnection.instance_name}`, 'polite');
            
          } catch (updateError) {
            console.error('Erro ao atualizar conexão:', updateError);
          }
        }
        
      } catch (pollError) {
        console.warn('Erro no polling de status:', pollError);
      }
    };

    // Iniciar polling imediatamente e depois a cada 2 segundos
    const timer = setInterval(poll, 2000);
    poll();
    
    return () => { 
      cancelled = true; 
      clearInterval(timer); 
    };
  }, [isQrModalOpen, selectedConnection, evolutionApiRequest, announce]);

  const handleConnect = async (connection: Connection) => {
    setSelectedConnection(connection);
    setIsQrModalOpen(true);
    setIsConnecting(connection.id);
    setQrCodeData('');
    setPairingCode('');

    announce(`Iniciando conexão da instância ${connection.instance_name}`, 'polite');

    try {
      // Primeiro, atualizar status para "conectando" no banco local
      await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      // Tentar conectar na API Evolution
      const connectEndpoints = [
        API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name),
        `/instance/connect/${connection.instance_name}`,
        `/v1/instance/connect/${connection.instance_name}`,
      ];

      let connectionResponse: any = null;
      let lastError: string = '';

      for (const endpoint of connectEndpoints) {
        try {
          const res = await evolutionApiRequest<any>(endpoint, {
            method: 'GET',
            suppressToast: true,
          });
          
          if (res) {
            connectionResponse = res;
            break;
          }
        } catch (e: any) {
          lastError = e.message || 'Erro desconhecido';
          continue;
        }
      }

      if (!connectionResponse) {
        throw new Error(lastError || 'Não foi possível conectar à API Evolution');
      }

      // Extrair QR code e pairing code da resposta
      let qr = connectionResponse?.base64 || connectionResponse?.qrcode || connectionResponse?.qrCode;
      const pairing = connectionResponse?.pairingCode || connectionResponse?.code;

      // Fallback: tentar buscar QR code em endpoint dedicado
      if (!qr && !pairing) {
        try {
          const qrEndpoints = [
            API_ENDPOINTS.INSTANCE_QR_CODE(connection.instance_name),
            `/instance/qrcode/${connection.instance_name}`,
            `/v1/instance/qrcode/${connection.instance_name}`,
          ];

          for (const qrEndpoint of qrEndpoints) {
            try {
              const qrRes = await evolutionApiRequest<any>(qrEndpoint, {
                method: 'GET',
                suppressToast: true,
              });
              
              if (qrRes) {
                qr = qrRes?.base64 || qrRes?.qrcode || qrRes?.qrCode;
                if (qr) break;
              }
            } catch (e) {
              continue;
            }
          }
        } catch (qrError) {
          console.warn('Erro ao buscar QR code:', qrError);
        }
      }

      // Atualizar status para "conectando" se temos QR ou pairing code
      if (qr || pairing) {
        await dbClient.connections.update(connection.id, { status: 'WAITING_QR_CODE' });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'WAITING_QR_CODE' } : c
        ));
      }

      // Definir dados do QR/pairing
      if (qr) {
        setQrCodeData(qr);
        announce('QR Code gerado com sucesso. Escaneie com seu WhatsApp.', 'polite');
      }
      if (pairing) {
        setPairingCode(pairing);
        announce(`Código de pareamento gerado: ${pairing}`, 'polite');
      }

      if (!qr && !pairing) {
        toast.warning('QR Code não recebido', { 
          description: 'A instância pode já estar conectada ou há um problema na API.' 
        });
        
        // Verificar status atual da instância
        try {
          const statusRes = await evolutionApiRequest<any>(API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name), {
            method: 'GET',
            suppressToast: true,
          });
          
          const isConnected = statusRes?.state === 'open' || statusRes?.connected || statusRes?.isConnected;
          if (isConnected) {
            await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
            setConnections(prev => prev.map(c => 
              c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
            ));
            setIsQrModalOpen(false);
            toast.success('Instância já está conectada!');
            return;
          }
        } catch (statusError) {
          console.warn('Erro ao verificar status:', statusError);
        }
      }

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error('Erro ao iniciar conexão', { description: error.message });
      
      // Reverter status para desconectado em caso de erro
      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
      ));
      
      setIsQrModalOpen(false);
      announce(`Erro ao conectar: ${error.message}`, 'assertive');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (connection: Connection) => {
    try {
      announce(`Desconectando instância ${connection.instance_name}`, 'polite');
      
      // Atualizar status local imediatamente
      await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      // Tentar múltiplos endpoints de logout
      const logoutEndpoints = [
        API_ENDPOINTS.INSTANCE_LOGOUT(connection.instance_name),
        `/instance/logout/${connection.instance_name}`,
        `/v1/instance/logout/${connection.instance_name}`,
      ];

      let success = false;
      let lastError = '';

      for (const endpoint of logoutEndpoints) {
        try {
          await evolutionApiRequest<any>(endpoint, {
            method: 'DELETE',
            suppressToast: true,
          });
          success = true;
          break;
        } catch (e: any) {
          lastError = e.message || 'Erro desconhecido';
          continue;
        }
      }

      if (success) {
        // Atualizar para desconectado após sucesso
        await dbClient.connections.update(connection.id, { 
          status: 'DISCONNECTED',
          instance_data: {
            ...(connection.instance_data as any),
            disconnectedAt: new Date().toISOString(),
          }
        });
        setConnections(prev => prev.map(c => 
          c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c
        ));
        
        toast.success('WhatsApp desconectado com sucesso.');
        announce(`Instância ${connection.instance_name} desconectada`, 'polite');
      } else {
        throw new Error(lastError || 'Não foi possível desconectar da API Evolution');
      }
      
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar', { description: error.message });
      
      // Reverter status em caso de erro
      await dbClient.connections.update(connection.id, { status: 'CONNECTED' });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
      ));
      
      announce(`Erro ao desconectar: ${error.message}`, 'assertive');
    }
  };

  const handlePause = async (connection: Connection) => {
    try {
      announce(`Pausando instância ${connection.instance_name}`, 'polite');
      
      // Atualizar status local imediatamente
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      // Configurações para pausar atividade
      const pauseSettings = {
        reject_call: false,
        groups_ignore: true,
        always_online: false,
        read_messages: false,
        read_status: false,
        sync_full_history: false,
      };

      // Tentar ajustar configurações
      try {
        const settingsEndpoints = [
          API_ENDPOINTS.SETTINGS_SET(connection.instance_name),
          `/settings/set/${connection.instance_name}`,
          `/v1/settings/set/${connection.instance_name}`,
        ];

        for (const endpoint of settingsEndpoints) {
          try {
            await evolutionApiRequest<any>(endpoint, {
              method: 'POST',
              body: JSON.stringify(pauseSettings),
              suppressToast: true,
            });
            break;
          } catch (e) {
            continue;
          }
        }
      } catch (settingsError) {
        console.warn('Erro ao ajustar configurações:', settingsError);
      }

      // Desabilitar webhook para pausar eventos
      try {
        let finalWebhookUrl = webhookUrlEnv;
        if (!finalWebhookUrl) {
          if (backendUrl) {
            const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
            finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
          } else {
            finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
          }
        }

        if (finalWebhookUrl) {
          const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user!.id)}`;
          
          const webhookEndpoints = [
            API_ENDPOINTS.WEBHOOK_SET(connection.instance_name),
            `/webhook/set/${connection.instance_name}`,
            `/v1/webhook/set/${connection.instance_name}`,
          ];

          for (const endpoint of webhookEndpoints) {
            try {
              await evolutionApiRequest<any>(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                  url: webhookWithUid,
                  events: [],
                  webhook_by_events: false,
                  webhook_base64: false,
                  enabled: false,
                }),
                suppressToast: true,
              });
              break;
            } catch (e) {
              continue;
            }
          }
        }
      } catch (webhookError) {
        console.warn('Erro ao desabilitar webhook:', webhookError);
      }

      // Atualizar status para pausado
      await dbClient.connections.update(connection.id, { 
        status: 'PAUSED',
        instance_data: {
          ...(connection.instance_data as any),
          pausedAt: new Date().toISOString(),
        }
      });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'PAUSED' } : c
      ));

      toast.success('Conexão pausada com sucesso.');
      announce(`Instância ${connection.instance_name} pausada`, 'polite');
      
    } catch (error: any) {
      console.error('Erro ao pausar:', error);
      toast.error('Erro ao pausar conexão', { description: error.message });
      
      // Reverter status em caso de erro
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'CONNECTED' } : c
      ));
      
      announce(`Erro ao pausar: ${error.message}`, 'assertive');
    }
  };

  const handleResume = async (connection: Connection) => {
    try {
      announce(`Retomando instância ${connection.instance_name}`, 'polite');
      
      // Atualizar status local imediatamente
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'INITIALIZING' } : c
      ));

      // Configurações para reativar
      const resumeSettings = {
        reject_call: false,
        groups_ignore: true,
        always_online: true,
        read_messages: true,
        read_status: true,
        sync_full_history: false,
      };

      // Tentar reativar configurações
      try {
        const settingsEndpoints = [
          API_ENDPOINTS.SETTINGS_SET(connection.instance_name),
          `/settings/set/${connection.instance_name}`,
          `/v1/settings/set/${connection.instance_name}`,
        ];

        for (const endpoint of settingsEndpoints) {
          try {
            await evolutionApiRequest<any>(endpoint, {
              method: 'POST',
              body: JSON.stringify(resumeSettings),
              suppressToast: true,
            });
            break;
          } catch (e) {
            continue;
          }
        }
      } catch (settingsError) {
        console.warn('Erro ao reativar configurações:', settingsError);
      }

      // Reabilitar webhook
      try {
        let finalWebhookUrl = webhookUrlEnv;
        if (!finalWebhookUrl) {
          if (backendUrl) {
            const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
            finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
          } else {
            finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
          }
        }

        if (finalWebhookUrl) {
          const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user!.id)}`;
          
          const webhookEndpoints = [
            API_ENDPOINTS.WEBHOOK_SET(connection.instance_name),
            `/webhook/set/${connection.instance_name}`,
            `/v1/webhook/set/${connection.instance_name}`,
          ];

          for (const endpoint of webhookEndpoints) {
            try {
              await evolutionApiRequest<any>(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                  url: webhookWithUid,
                  webhook_by_events: true,
                  webhook_base64: false,
                  enabled: true,
                  events: [
                    'APPLICATION_STARTUP',
                    'QRCODE_UPDATED',
                    'CONNECTION_UPDATE',
                    'MESSAGES_UPSERT'
                  ],
                }),
                suppressToast: true,
              });
              break;
            } catch (e) {
              continue;
            }
          }
        }
      } catch (webhookError) {
        console.warn('Erro ao reabilitar webhook:', webhookError);
      }

      // Verificar estado atual da instância
      let finalStatus: ConnectionStatus = 'DISCONNECTED';
      
      try {
        const statusEndpoints = [
          API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name),
          `/instance/connectionState/${connection.instance_name}`,
          `/v1/instance/connectionState/${connection.instance_name}`,
        ];

        for (const endpoint of statusEndpoints) {
          try {
            const statusRes = await evolutionApiRequest<any>(endpoint, {
              method: 'GET',
              suppressToast: true,
            });
            
            if (statusRes) {
              const state = String(statusRes?.state || statusRes?.status || statusRes?.connectionState || '').toLowerCase();
              const connected = state === 'open' || state === 'connected' || state === 'ready' || 
                              Boolean(statusRes?.connected || statusRes?.isConnected);
              finalStatus = connected ? 'CONNECTED' : 'DISCONNECTED';
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } catch (statusError) {
        console.warn('Erro ao verificar status:', statusError);
      }

      // Atualizar status final
      await dbClient.connections.update(connection.id, { 
        status: finalStatus,
        instance_data: {
          ...(connection.instance_data as any),
          resumedAt: new Date().toISOString(),
        }
      });
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: finalStatus } : c
      ));

      const statusMessage = finalStatus === 'CONNECTED' ? 
        'Conexão retomada e WhatsApp está conectado.' : 
        'Conexão retomada. WhatsApp precisa ser reconectado.';
        
      toast.success(statusMessage);
      announce(`Instância ${connection.instance_name} retomada`, 'polite');
      
    } catch (error: any) {
      console.error('Erro ao retomar:', error);
      toast.error('Erro ao retomar conexão', { description: error.message });
      
      // Reverter status em caso de erro
      setConnections(prev => prev.map(c => 
        c.id === connection.id ? { ...c, status: 'PAUSED' } : c
      ));
      
      announce(`Erro ao retomar: ${error.message}`, 'assertive');
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

    // Verificar se as configurações da API estão definidas
    if (!evolutionApiRequest) {
      toast.error('Configurações da API não encontradas', { 
        description: 'Configure a URL e a Chave de API na página de Configurações antes de criar uma instância.' 
      });
      return;
    }

    setIsCreating(true);
    announce(`Criando instância ${newConnectionName}`, 'polite');

    try {
      // Primeiro, criar a instância no banco local com status DISCONNECTED
      const created = await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        instance_data: { created_at: new Date().toISOString() },
      });

      // Atualizar lista local imediatamente
      setConnections(prev => [created, ...prev]);
      
      // Preparar webhook URL
      let finalWebhookUrl = webhookUrlEnv;
      if (!finalWebhookUrl) {
        if (backendUrl) {
          const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
          finalWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
        } else {
          finalWebhookUrl = `${window.location.origin}/api/whatsapp/webhook`;
        }
      }

      // Tentar criar a instância na API Evolution
      if (finalWebhookUrl) {
        try {
          const webhookWithUid = `${finalWebhookUrl}?uid=${encodeURIComponent(user.id)}`;

          const createPayload: any = {
            instanceName: newConnectionName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: webhookWithUid,
            webhook_by_events: true,
            webhook_base64: false,
            events: [
              'APPLICATION_STARTUP',
              'QRCODE_UPDATED', 
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT'
            ],
            // Configurações otimizadas
            reject_call: false,
            msg_call: '',
            groups_ignore: true,
            always_online: false, // Iniciar desconectado
            read_messages: false, // Iniciar desabilitado
            read_status: false,   // Iniciar desabilitado
            sync_full_history: false,
          };

          // Tentar múltiplos endpoints para compatibilidade
          const createEndpoints = [
            API_ENDPOINTS.INSTANCE_CREATE,
            '/instance/create',
            '/instances/create', 
            '/v1/instance/create',
            '/v1/instances/create',
          ];

          let creationResponse: EvolutionInstanceCreateResponse | null = null;
          let lastError: string = '';

          for (const ep of createEndpoints) {
            try {
              const res = await evolutionApiRequest<EvolutionInstanceCreateResponse>(ep, {
                method: 'POST',
                body: JSON.stringify(createPayload),
                suppressToast: true,
              });
              
              if (res && res.status !== 'error') { 
                creationResponse = res; 
                break; 
              } else if (res?.message) {
                lastError = res.message;
              }
            } catch (e: any) {
              lastError = e.message || 'Erro desconhecido';
              continue;
            }
          }

          // Atualizar dados da instância se a criação na API foi bem-sucedida
          if (creationResponse) {
            await dbClient.connections.update(created.id, {
              instance_data: {
                ...creationResponse,
                created_at: new Date().toISOString(),
                api_created: true
              }
            });
            
            toast.success(`Instância "${newConnectionName}" criada com sucesso na API Evolution.`);
          } else {
            // Se falhou na API, manter no banco mas avisar o usuário
            console.warn('Falha ao criar na API Evolution:', lastError);
            toast.warning(`Instância "${newConnectionName}" criada localmente`, { 
              description: 'Não foi possível criar na API Evolution. Você pode tentar conectar manualmente.' 
            });
          }
        } catch (apiError: any) {
          console.warn('Erro ao criar na API Evolution:', apiError.message);
          toast.warning(`Instância "${newConnectionName}" criada localmente`, { 
            description: 'Erro na API Evolution. Verifique as configurações e tente conectar manualmente.' 
          });
        }
      }

      announce(`Instância ${newConnectionName} criada com sucesso`, 'polite');
      setIsCreateModalOpen(false);
      setNewConnectionName('');

    } catch (error: any) {
      toast.error('Falha ao criar instância', { description: error.message });
      announce(`Erro ao criar instância: ${error.message}`, 'assertive');
    } finally {
      setIsCreating(false);
    }
  };

  const getPhoneNumber = (connection: Connection) => {
    const instanceData = connection.instance_data as any;
    return instanceData?.owner?.split('@')[0] || 'Não disponível';
  };

  return (
    <AccessibilityProvider>
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Skip navigation for keyboard users */}
      <SkipLink href="#main-content">
        Pular para o conteúdo principal
      </SkipLink>
      <SkipLink href="#connections-grid">
        Pular para a lista de conexões
      </SkipLink>
      
      {/* Modern page container with enhanced responsive spacing and accessibility */}
      <div className={cn(
        "container-responsive space-y-6 sm:space-y-8 lg:space-y-10",
        // Improved vertical spacing with better mobile optimization
        "py-6 sm:py-8 lg:py-12 xl:py-16"
      )}>
        
        {/* Enhanced modern page header with comprehensive responsive optimization */}
        <header 
          className={cn(
            "header-responsive",
            // Comprehensive responsive layout with optimal visual hierarchy
            "flex flex-col gap-4 xs:gap-5 sm:gap-6 md:gap-7 lg:gap-8 xl:gap-10",
            // Enhanced responsive layout with better alignment optimization
            "sm:flex-row sm:items-start sm:justify-between",
            "lg:items-center xl:items-start 2xl:items-center",
            // Optimized spacing and enhanced visual separation
            "pb-3 sm:pb-4 lg:pb-5 xl:pb-6",
            "border-b border-border/30 dark:border-border/20"
          )}
          role="banner"
        >
          {/* Enhanced title section with modern typography hierarchy and accessibility */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-5">
            <div className="space-y-2">
              {/* Modern page title with enhanced typography and accessibility */}
              <AccessibleHeading 
                level={1}
                id="main-content"
                className={cn(
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
                )}
              >
                Gerenciar Conexões
              </AccessibleHeading>
              
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
            
            {/* Enhanced description with better readability and accessibility */}
            <p 
              className={cn(
                "typography-body-lg text-muted-foreground",
                "max-w-2xl leading-relaxed",
                // Better responsive text sizing
                "text-base sm:text-lg lg:text-xl",
                // Enhanced line height for readability
                "leading-7 sm:leading-8"
              )}
              role="doc-subtitle"
            >
              Gerencie suas instâncias do WhatsApp de forma profissional e intuitiva. 
              Conecte múltiplas contas e centralize todos os seus atendimentos.
            </p>
          </div>
          
          {/* Enhanced action buttons with comprehensive responsive optimization and accessibility */}
          <div 
            className={cn(
              "nav-responsive",
              // Comprehensive responsive gap optimization
              "gap-3 xs:gap-4 sm:gap-5 lg:gap-4 xl:gap-5",
              // Enhanced responsive layout with optimal mobile experience
              "w-full sm:w-auto",
              "flex-col xs:flex-row sm:flex-row",
              // Optimized alignment and spacing with better visual hierarchy
              "sm:shrink-0 sm:self-start lg:self-center xl:self-start 2xl:self-center"
            )}
            role="group"
            aria-label="Ações principais da página"
          >
            {/* Enhanced refresh button with comprehensive responsive optimization and accessibility */}
            <Button 
              variant="outline" 
              size="default"
              onClick={() => {
                fetchConnections();
                announce('Atualizando lista de conexões', 'polite');
              }} 
              disabled={loading}
              loading={loading}
              icon={RefreshCw}
              className={cn(
                // Comprehensive responsive button optimization
                "btn-responsive-md",
                // Enhanced base styling with better performance
                "transition-all duration-300 ease-out transform-gpu",
                // Comprehensive mobile touch targets with WCAG AA compliance
                "touch-target-primary",
                "w-full xs:w-auto sm:w-auto",
                // Enhanced hover and focus states with better visual feedback
                "hover:border-primary/60 hover:bg-primary/8 hover:text-primary-700",
                "hover:shadow-md hover:scale-[1.02] lg:hover:scale-[1.03]",
                "active:scale-[0.98] active:shadow-sm active:transition-transform active:duration-150",
                // Comprehensive accessibility enhancements
                "focus-ring-enhanced keyboard-navigable btn-accessible",
                // Enhanced loading state with better visual feedback
                loading && "animate-pulse border-primary/40 bg-primary/5",
                // Improved disabled state with better UX
                "disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:border-input",
                // Comprehensive reduced motion support
                "motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:transition-none",
                // Better interaction area optimization
                "interaction-area-mobile sm:interaction-area-desktop"
              )}
              aria-label={loading ? "Atualizando lista de conexões..." : "Atualizar lista de conexões"}
              aria-describedby="refresh-description"
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
            
            {/* Enhanced create button with comprehensive responsive optimization and accessibility */}
            <Button 
              variant="gradient" 
              size="default"
              onClick={() => {
                setIsCreateModalOpen(true);
                announce('Abrindo formulário para criar nova conexão', 'polite');
              }}
              icon={Plus}
              className={cn(
                // Comprehensive responsive button optimization
                "btn-responsive-md",
                // Enhanced gradient styling with better performance and shadows
                "shadow-lg hover:shadow-xl hover:shadow-primary/25 lg:hover:shadow-2xl",
                "transform-gpu transition-all duration-300 ease-out",
                // Comprehensive mobile touch targets with WCAG AA compliance
                "touch-target-primary",
                "w-full xs:w-auto sm:w-auto",
                // Enhanced hover and interaction states with better visual feedback
                "hover:scale-[1.03] hover:-translate-y-0.5 lg:hover:scale-[1.04] lg:hover:-translate-y-1",
                "active:scale-[0.97] active:translate-y-0 active:transition-transform active:duration-150",
                // Comprehensive accessibility enhancements
                "focus-ring-enhanced keyboard-navigable btn-accessible",
                // Better gradient hover effects with enhanced visual appeal
                "hover:from-primary-600 hover:to-primary-700 lg:hover:from-primary-700 lg:hover:to-primary-800",
                // Enhanced text styling with better readability
                "font-semibold tracking-wide",
                // Comprehensive reduced motion support
                "motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0",
                "motion-reduce:active:scale-100 motion-reduce:transition-none",
                // Better interaction area optimization
                "interaction-area-mobile sm:interaction-area-desktop"
              )}
              aria-label="Criar nova conexão WhatsApp"
              aria-describedby="create-description"
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

        {/* Hidden descriptions for screen readers */}
        <div className="sr-only">
          <div id="refresh-description">
            Atualiza a lista de conexões WhatsApp, buscando o status mais recente de todas as instâncias
          </div>
          <div id="create-description">
            Abre um formulário para criar uma nova instância de conexão WhatsApp
          </div>
        </div>

        {/* Enhanced main content area with improved spacing and accessibility */}
        <main 
          className="space-y-6 sm:space-y-8"
          role="main"
          aria-label="Lista de conexões WhatsApp"
        >
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

          {/* Enhanced responsive connections grid with optimized layout and accessibility */}
          {!loading && connections.length > 0 && (
            <section 
              className={cn(
                "spacing-responsive-md",
                // Enhanced responsive spacing for better content hierarchy
                "space-y-4 sm:space-y-5 lg:space-y-6 xl:space-y-8"
              )} 
              aria-labelledby="connections-section-title"
            >
              {/* Enhanced grid header with responsive layout and improved accessibility */}
              <div className={cn(
                "flex items-center justify-between",
                // Responsive layout with better mobile stacking
                "flex-col gap-3 xs:flex-row xs:gap-4 sm:gap-6",
                // Enhanced spacing and alignment
                "pb-2 sm:pb-3 lg:pb-4",
                "border-b border-border/30"
              )}>
                <div className="space-y-1 sm:space-y-2 w-full xs:w-auto">
                  <AccessibleHeading 
                    level={2} 
                    id="connections-section-title"
                    className="sr-only"
                  >
                    Lista de Conexões WhatsApp
                  </AccessibleHeading>
                  <div className="flex items-center justify-between xs:justify-start xs:gap-4">
                    <p 
                      className={cn(
                        "font-medium text-muted-foreground",
                        // Responsive text sizing for better readability
                        "text-sm sm:text-base lg:text-lg"
                      )}
                      role="status"
                      aria-live="polite"
                    >
                      {connections.length} {connections.length === 1 ? 'conexão' : 'conexões'} encontrada{connections.length === 1 ? '' : 's'}
                    </p>
                    
                    {/* Connection status summary for better overview */}
                    <div className="flex items-center gap-2 xs:hidden sm:flex">
                      {(() => {
                        const statusCounts = connections.reduce((acc, conn) => {
                          const status = normalizeStatus(conn.status);
                          acc[status] = (acc[status] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        
                        return Object.entries(statusCounts).map(([status, count]) => (
                          <div 
                            key={status}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              status === 'connected' && "bg-success/10 text-success",
                              status === 'connecting' && "bg-info/10 text-info", 
                              status === 'disconnected' && "bg-error/10 text-error",
                              status === 'paused' && "bg-warning/10 text-warning"
                            )}
                          >
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              status === 'connected' && "bg-success",
                              status === 'connecting' && "bg-info animate-pulse",
                              status === 'disconnected' && "bg-error",
                              status === 'paused' && "bg-warning"
                            )} />
                            <span>{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Optional filter/sort controls for future enhancement */}
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Visualização em Grade
                  </span>
                </div>
              </div>
              
              {/* Enhanced responsive grid with comprehensive breakpoint optimization and accessibility */}
              <div 
                ref={gridRef}
                id="connections-grid"
                className={cn(
                  // Use the enhanced responsive grid system
                  "card-grid-responsive",
                  // Optimized gap spacing for different screen sizes
                  "gap-4 xs:gap-5 sm:gap-6 md:gap-7 lg:gap-8 xl:gap-10 2xl:gap-12",
                  // Ensure consistent card heights across rows for better visual alignment
                  "items-stretch auto-rows-fr",
                  // Performance optimizations for large grids
                  "will-change-contents",
                  // Enhanced accessibility for grid navigation
                  "focus-within:outline-none keyboard-grid-navigation"
                )}
                role="grid"
                aria-label={`Grade com ${connections.length} conexões WhatsApp organizadas em ${Math.ceil(connections.length / 3)} linhas`}
                aria-rowcount={Math.ceil(connections.length / 3)} // Dynamic calculation for desktop 3-column layout
                aria-colcount={3} // Default desktop column count
                tabIndex={0}
                // Enhanced keyboard navigation support
                onKeyDown={handleGridKeyDown}
                onFocus={() => {
                  // Focus first item when grid receives focus
                  if (connections.length > 0) {
                    focusItem(0);
                  }
                }}
              >
                {connections.map((connection, index) => {
                  const uiStatus: UiStatus = normalizeStatus(connection.status);
                  const isSelectedAndConnecting = isConnecting === connection.id;

                  return (
                    <div
                      key={connection.id}
                      className={cn(
                        "group relative",
                        // Comprehensive responsive height optimization for different screen densities
                        "min-h-[280px] xs:min-h-[290px] sm:min-h-[300px] md:min-h-[310px]", 
                        "lg:min-h-[320px] xl:min-h-[330px] 2xl:min-h-[340px]",
                        // Enhanced touch-friendly interactions with accessibility compliance
                        "touch-manipulation select-none cursor-pointer",
                        // Performance optimizations for smooth animations
                        "transform-gpu transition-all duration-300 ease-out",
                        "will-change-transform backface-visibility-hidden",
                        // Enhanced hover states with better z-index management for desktop
                        "hover:z-10 lg:hover:z-20",
                        // Comprehensive focus management for keyboard navigation
                        "focus-within:z-30 focus-within:outline-none",
                        // Enhanced mobile interaction feedback
                        "active:scale-[0.98] active:transition-transform active:duration-150",
                        // Reduced motion support for accessibility
                        "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
                        "motion-reduce:transition-none motion-reduce:will-change-auto"
                      )}
                      // Enhanced accessibility attributes for grid navigation
                      role="gridcell"
                      aria-rowindex={Math.floor(index / 3) + 1}
                      aria-colindex={(index % 3) + 1}
                      tabIndex={-1} // Managed by card component focus
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
                          // Enhanced responsive card behavior with comprehensive optimization
                          "card-responsive",
                          // Optimized touch interactions for mobile devices
                          "touch-manipulation cursor-pointer",
                          // Enhanced performance optimizations
                          "transform-gpu transition-all duration-300 ease-out",
                          "will-change-transform backface-visibility-hidden",
                          // Comprehensive hover states with better visual hierarchy
                          "hover:z-10 lg:hover:z-20 hover:shadow-xl",
                          "hover:scale-[1.02] hover:-translate-y-1",
                          // Enhanced focus management for accessibility compliance
                          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2",
                          "focus-within:ring-offset-background focus-within:z-30",
                          // Optimized mobile touch feedback with better responsiveness
                          "active:scale-[0.98] active:translate-y-0 active:shadow-lg",
                          "active:transition-transform active:duration-150",
                          // Comprehensive reduced motion support for accessibility
                          "motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0",
                          "motion-reduce:active:scale-100 motion-reduce:transition-none",
                          "motion-reduce:will-change-auto",
                          // Enhanced content density optimization
                          "content-density-cozy"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Live region for status announcements */}
      <LiveRegionComponent />

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
        <div className="space-y-8">
          {/* Enhanced instance info header with professional card design */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
            <div className="relative p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 backdrop-blur-sm">
              <div className="flex items-center justify-center space-x-3">
                <div className="flex-shrink-0 w-3 h-3 bg-primary rounded-full animate-pulse" />
                <div className="text-center">
                  <p className="typography-body-sm text-muted-foreground font-medium">
                    Conectando instância
                  </p>
                  <p className="typography-h4 font-bold text-foreground mt-1 tracking-tight">
                    {selectedConnection?.instance_name}
                  </p>
                </div>
                <div className="flex-shrink-0 w-3 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
            </div>
          </div>

          {/* Enhanced QR Code / Pairing content with professional card styling */}
          <div className="flex flex-col items-center justify-center space-y-8 min-h-[380px]">
            {(isConnecting || apiLoading) && !qrCodeData && !pairingCode ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  {/* Enhanced loading animation with multiple layers */}
                  <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-2xl animate-pulse" />
                  <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 to-primary/20 rounded-full blur-xl animate-ping" />
                  <div className="relative p-8 bg-gradient-to-br from-card via-card/95 to-card/90 rounded-2xl border border-border/50 shadow-2xl backdrop-blur-sm">
                    <Loader2 className="h-20 w-20 animate-spin text-primary mx-auto" />
                  </div>
                </div>
                <div className="text-center space-y-3 max-w-md">
                  <p className="typography-h4 font-semibold text-foreground">Gerando QR Code...</p>
                  <p className="typography-body text-muted-foreground leading-relaxed">
                    Aguarde enquanto preparamos sua conexão segura com o WhatsApp
                  </p>
                  <div className="flex items-center justify-center space-x-1 pt-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center space-y-8">
                {/* Enhanced QR code container with professional styling */}
                <div className="relative group">
                  <div className="absolute -inset-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-all duration-500" />
                  <div className="absolute -inset-3 bg-gradient-to-r from-primary/30 to-primary/20 rounded-2xl blur-lg opacity-50" />
                  <div className="relative p-8 bg-white dark:bg-gray-50 rounded-2xl shadow-2xl border border-border/30 group-hover:shadow-3xl transition-all duration-300">
                    <div className="relative">
                      <img 
                        src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`} 
                        alt="QR Code para conectar WhatsApp" 
                        className="w-72 h-72 rounded-xl shadow-inner"
                      />
                      {/* Subtle corner accents */}
                      <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-primary/40 rounded-tl-lg" />
                      <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-primary/40 rounded-tr-lg" />
                      <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-primary/40 rounded-bl-lg" />
                      <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-primary/40 rounded-br-lg" />
                    </div>
                  </div>
                </div>
                
                {/* Enhanced instructions with better visual hierarchy */}
                <div className="text-center space-y-4 max-w-md">
                  <div className="space-y-2">
                    <p className="typography-h4 font-semibold text-foreground">Escaneie com o WhatsApp</p>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-primary to-primary/60 mx-auto rounded-full" />
                  </div>
                  <div className="p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/30">
                    <p className="typography-body text-muted-foreground leading-relaxed">
                      1. Abra o <strong className="text-foreground">WhatsApp</strong> no seu celular<br />
                      2. Vá em <strong className="text-foreground">Dispositivos conectados</strong><br />
                      3. Toque em <strong className="text-foreground">Conectar dispositivo</strong><br />
                      4. Escaneie este código QR
                    </p>
                  </div>
                </div>
              </div>
            ) : pairingCode ? (
              <div className="flex flex-col items-center space-y-8">
                {/* Enhanced pairing code container */}
                <div className="relative group">
                  <div className="absolute -inset-6 bg-gradient-to-r from-success/20 via-success/10 to-success/20 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-all duration-500" />
                  <div className="absolute -inset-3 bg-gradient-to-r from-success/30 to-success/20 rounded-2xl blur-lg opacity-50" />
                  <div className="relative p-10 bg-gradient-to-br from-card via-card/95 to-card/90 rounded-2xl shadow-2xl border border-success/20 backdrop-blur-sm">
                    <div className="text-center space-y-4">
                      <p className="typography-body font-semibold text-success uppercase tracking-wider">
                        Código de Pareamento
                      </p>
                      <div className="relative">
                        <p className="typography-display text-5xl font-bold tracking-[0.2em] text-foreground font-mono bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                          {pairingCode}
                        </p>
                        <div className="absolute inset-0 bg-gradient-to-r from-success/10 to-success/5 rounded-lg blur-sm -z-10" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Enhanced pairing instructions */}
                <div className="text-center space-y-4 max-w-md">
                  <div className="space-y-2">
                    <p className="typography-h4 font-semibold text-foreground">Digite no WhatsApp</p>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-success to-success/60 mx-auto rounded-full" />
                  </div>
                  <div className="p-4 bg-gradient-to-r from-success/10 to-success/5 rounded-lg border border-success/20">
                    <p className="typography-body text-muted-foreground leading-relaxed">
                      Insira este código no WhatsApp para parear sua instância de forma segura
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                {/* Enhanced error state */}
                <div className="relative">
                  <div className="absolute -inset-6 bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 rounded-3xl blur-2xl opacity-75" />
                  <div className="relative p-8 bg-gradient-to-br from-card via-card/95 to-card/90 rounded-2xl border border-destructive/20 shadow-2xl backdrop-blur-sm">
                    <AlertTriangle className="h-20 w-20 text-destructive mx-auto" />
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-md">
                  <div className="space-y-2">
                    <p className="typography-h4 font-semibold text-destructive">Erro ao gerar QR Code</p>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-destructive to-destructive/60 mx-auto rounded-full" />
                  </div>
                  <div className="p-4 bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-lg border border-destructive/20">
                    <p className="typography-body text-muted-foreground leading-relaxed">
                      Não foi possível obter o código. Verifique as configurações da API e tente novamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced action buttons with better styling */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-border/30">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="typography-body-sm">Aguardando conexão...</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsQrModalOpen(false)}
                className="hover:bg-muted/50 hover:border-primary/40 transition-all duration-200"
              >
                Fechar
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => handleConnect(selectedConnection!)}
                disabled={!!isConnecting || apiLoading}
                loading={!!isConnecting || apiLoading}
                className="hover:bg-primary/10 hover:text-primary transition-all duration-200"
              >
                Atualizar QR
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <AlertDialog 
        isOpen={isDeleteDialogOpen} 
        onClose={() => setIsDeleteDialogOpen(false)} 
        onConfirm={confirmDelete} 
        title="Confirmar Exclusão" 
        description={`Tem certeza que deseja excluir permanentemente a instância "${selectedConnection?.instance_name}"? Esta ação não pode ser desfeita e todos os dados serão perdidos.`} 
        confirmText={isDeleting ? "Excluindo..." : "Excluir Instância"} 
        cancelText="Manter Instância"
        isConfirming={isDeleting}
        variant="destructive"
      />
    </div>
    </AccessibilityProvider>
  );
}
