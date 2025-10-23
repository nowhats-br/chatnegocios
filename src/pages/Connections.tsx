import { useState, useEffect, useCallback, useRef } from 'react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Modal from '@/components/ui/Modal';
import { Plus, QrCode, Loader2, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';
import { dbClient } from '@/lib/dbClient';
import { Connection, ConnectionStatus } from '@/types/database';
import { toast } from 'sonner';
import { useEvolutionApi } from '@/hooks/useEvolutionApi';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/apiEndpoints';

import AlertDialog from '@/components/ui/AlertDialog';
import { 
  EvolutionInstanceCreateRequest, 
  EvolutionInstanceCreateResponse, 
  STATUS_CONFIG,
  STATUS_MAPPING,
} from '@/types/evolution-api';

type UiStatus = keyof typeof STATUS_CONFIG;

const resolveStatusFromResponse = (res: any, instanceName: string): string | null => {
  if (!res) return null;
  if (res?.connected === true || res?.isConnected === true || res?.whatsappConnected === true) return 'CONNECTED';
  const direct = res?.status || res?.state;
  const instance = res?.instance || null;
  const instStatus = instance?.status || instance?.state || null;
  const listItem = Array.isArray(res?.instances)
    ? res.instances.find((it: any) => it?.instanceName === instanceName || it?.instance === instanceName)
    : null;
  const listStatus = listItem?.status || listItem?.state || null;
  const candidate = listStatus || instStatus || direct;
  return candidate ? String(candidate).toUpperCase() : null;
};

const normalizeStatus = (statusRaw: string | null, res: any): ConnectionStatus => {
  if (res?.connected === true || res?.isConnected === true || res?.whatsappConnected === true) return 'CONNECTED';
  const s = (statusRaw || '').toUpperCase();
  if (!s) {
    if (res?.qrcode || res?.qrCode || res?.pairingCode) return 'WAITING_QR_CODE';
    return 'DISCONNECTED';
  }
  if ([
    'CONNECTED', 'ONLINE', 'OPEN', 'LOGGED', 'LOGGED_IN', 'AUTHENTICATED', 'PAIR_SUCCESS'
  ].includes(s)) return 'CONNECTED';
  if ([
    'WAITING_QR_CODE', 'WAITING_QR', 'QRCODE', 'QR_CODE', 'PAIRING', 'QR'
  ].includes(s)) return 'WAITING_QR_CODE';
  if ([
    'INITIALIZING', 'STARTING', 'BOOTING', 'INITIALIZATION'
  ].includes(s)) return 'INITIALIZING';
  if ([
    'PAUSED', 'SUSPENDED'
  ].includes(s)) return 'PAUSED';
  if ([
    'DISCONNECTED', 'CLOSED', 'OFFLINE', 'LOGGED_OUT', 'LOGOUT'
  ].includes(s)) return 'DISCONNECTED';
  if (res?.connected === false) return 'DISCONNECTED';
  if (res?.qrcode || res?.qrCode || res?.pairingCode) return 'WAITING_QR_CODE';
  return 'DISCONNECTED';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  
  const { user } = useAuth();
  const { request: evolutionApiRequest } = useEvolutionApi();
  const qrEndpointTemplate = import.meta.env.VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE as string | undefined;
  const webhookUrlEnv = import.meta.env.VITE_EVOLUTION_WEBHOOK_URL as string | undefined;

  const statusPollRef = useRef<number | null>(null);
  const connectedNotifiedRef = useRef<Record<string, boolean>>({});
  const disconnectLockRef = useRef<Record<string, boolean>>({});

  const enforceWebhookConfig = useCallback(async (instanceName: string) => {
    const url = webhookUrlEnv || `${window.location.origin}/api/whatsapp/webhook`;
    const payload = {
      webhook: {
        url,
        byEvents: true,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        headers: { 'x-user-id': user?.id || '' },
      },
    };
    const candidates: Array<{ endpoint: string; method: 'POST' | 'PUT' | 'PATCH' }> = [
      { endpoint: `/instance/update/${instanceName}`, method: 'POST' },
      { endpoint: `/instance/webhook/${instanceName}`, method: 'POST' },
      { endpoint: `/instances/update/${instanceName}`, method: 'POST' },
      { endpoint: `/whatsapp/instance/update/${instanceName}`, method: 'POST' },
      { endpoint: `/instance/${instanceName}/webhook`, method: 'POST' },
    ];
    for (const c of candidates) {
      try {
        await evolutionApiRequest<any>(c.endpoint, {
          method: c.method,
          body: JSON.stringify(payload),
          suppressToast: true,
          suppressInfoToast: true,
        });
        return true;
      } catch (_) {
        // tenta próximo
      }
    }
    return false;
  }, [evolutionApiRequest, webhookUrlEnv, user?.id]);
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
        suppressToast: true,
        suppressInfoToast: true,
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
    try {
      const data = await dbClient.connections.list();
      setConnections(data as Connection[]);
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
    const refreshAll = async () => {
      for (const connection of connections) {
        const statusCandidates: string[] = [
          API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name),
          `/instance/status/${connection.instance_name}`,
          `/instance/connectionState/${connection.instance_name}`,
          `/instance/check/${connection.instance_name}`,
          `/instance/fetchInstances/${connection.instance_name}`,
          `/instance/fetchInstances`,
        ];

        let res: any = null;
        let status: string | null = null;
        for (const endpoint of statusCandidates) {
          const attempt = await evolutionApiRequest<any>(endpoint, { method: 'GET', suppressToast: true, suppressInfoToast: true });
          if (attempt) {
            const s = resolveStatusFromResponse(attempt, connection.instance_name);
            if (s) {
              res = attempt;
              status = s;
              break;
            }
          }
        }
        const normalized = normalizeStatus(status, res);
        if (normalized === 'CONNECTED' && connection.status !== 'CONNECTED') {
          const locked = !!disconnectLockRef.current[connection.instance_name];
          if (locked) {
            try { await enforceStop(connection.instance_name); } catch (_) {}
            // Não promover para CONNECTED; força UI como DISCONNECTED
            setConnections(prev => prev.map(c => c.id === connection.id ? { ...c, status: 'DISCONNECTED' } : c));
          } else {
            await dbClient.connections.update(connection.id, { status: 'CONNECTED', instance_data: res });
            setConnections(prev => prev.map(c => c.id === connection.id ? { ...c, status: 'CONNECTED' } : c));
            if (selectedConnection?.id === connection.id && isQrModalOpen) {
              setIsQrModalOpen(false);
              setQrCodeData('');
              setPairingCode('');
            }
            // Dispara sincronização inicial de conversas assim que a conexão ficar CONNECTED
            const alreadySynced = !!connectedNotifiedRef.current[connection.id];
            if (!alreadySynced) {
              try {
                toast.info('Sincronizando últimas conversas...');
                await dbClient.evolution.syncChats({ connection_id: connection.id, limit: 10 });
                connectedNotifiedRef.current[connection.id] = true;
              } catch (e: any) {
                toast.error('Erro ao sincronizar conversas', { description: e.message });
              }
            }
          }
        }
      }
    };
    if (!loading && connections.length > 0) {
      refreshAll().catch(() => {});
    }
  }, [loading, connections, evolutionApiRequest, selectedConnection, isQrModalOpen]);

  useEffect(() => {
    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Só cancela o polling automaticamente se está em processo de conexão via QR
    if (!isQrModalOpen && isConnecting && statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  }, [isQrModalOpen, isConnecting]);

  // Fecha automaticamente o modal de QR quando a conexão selecionada ficar CONNECTED
  useEffect(() => {
    if (isQrModalOpen && selectedConnection) {
      const current = connections.find(c => c.id === selectedConnection.id);
      if (current?.status === 'CONNECTED') {
        setIsQrModalOpen(false);
        setQrCodeData('');
        setPairingCode('');
        setIsConnecting(false);
      }
    }
  }, [connections, selectedConnection, isQrModalOpen]);

  // Removido canal de realtime (Supabase); atualiza via fetchConnections após ações

  // Conectar: abre modal, tenta iniciar conexão e obter QR/pareamento
  const handleConnect = async (connection: Connection) => {
    try {
      setSelectedConnection(connection);
      setIsQrModalOpen(true);
      setIsConnecting(true);
      // Libera qualquer bloqueio de reconexão ao iniciar conexão manualmente
      disconnectLockRef.current[connection.instance_name] = false;

      try {
        await enforceWebhookConfig(connection.instance_name);
      } catch (_) {}

      // Tenta iniciar a conexão nas rotas conhecidas
      const connectCandidates: Array<{ endpoint: string; method: 'GET' | 'POST' }> = [
        { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), method: 'GET' },
        { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), method: 'POST' },
        { endpoint: `/instance/connect/${connection.instance_name}`, method: 'GET' },
        { endpoint: `/instance/connect/${connection.instance_name}`, method: 'POST' },
      ];
      for (const c of connectCandidates) {
        try {
          await evolutionApiRequest<any>(c.endpoint, { method: c.method, suppressToast: true, suppressInfoToast: true });
          break; // qualquer sucesso já é suficiente
        } catch (_) {
          // tenta próximo
        }
      }

      // Busca QR Code ou código de pareamento
      const qr = await fetchQrDataWithFallback(connection.instance_name);
      if (qr) {
        setQrCodeData(qr.qrCode || '');
        setPairingCode(qr.pairing || '');
      } else {
        setQrCodeData('');
        setPairingCode('');
      }

      await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
      connectedNotifiedRef.current[connection.id] = false;
      startStatusPolling(connection);
    } catch (error: any) {
      toast.error('Erro ao conectar', { description: error.message });
      setIsConnecting(false);
    }
  };

  // Força parada da instância (stop/shutdown/close/logout)
  const enforceStop = async (instanceName: string) => {
    const candidates: Array<{ endpoint: string; method: 'POST' }> = [
      { endpoint: `/instance/stop/${instanceName}`, method: 'POST' },
      { endpoint: `/instance/shutdown/${instanceName}`, method: 'POST' },
      { endpoint: `/instance/close/${instanceName}`, method: 'POST' },
      { endpoint: `/instance/logout/${instanceName}`, method: 'POST' },
    ];
    for (const c of candidates) {
      try {
        await evolutionApiRequest<any>(c.endpoint, { method: c.method, suppressToast: true, suppressInfoToast: true });
        break;
      } catch (_) {}
    }
  };

  // Desconectar: tenta múltiplas rotas e atualiza backend/UI
  const handleDisconnect = async (connection: Connection) => {
    try {
      const candidates: Array<{ endpoint: string; method: 'POST' | 'DELETE' }> = [
        { endpoint: `/instance/disconnect/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/logout/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/close/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/shutdown/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/stop/${connection.instance_name}`, method: 'POST' },
      ];
      let success = false;
      for (const c of candidates) {
        try {
          await evolutionApiRequest<any>(c.endpoint, { method: c.method, suppressToast: true, suppressInfoToast: true });
          success = true;
          break;
        } catch (_) {
          // tenta próximo
        }
      }
      if (!success) {
        throw new Error('Falha ao desconectar em todas as rotas.');
      }
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      setIsQrModalOpen(false);
      setIsConnecting(false);
      setQrCodeData('');
      setPairingCode('');
      await dbClient.connections.update(connection.id, { status: 'DISCONNECTED' });
      // Bloqueia reconexão automática até ação explícita de conectar/retomar
      disconnectLockRef.current[connection.instance_name] = true;
      toast.success('Instância desconectada.');
      await fetchConnections();
    } catch (error: any) {
      toast.error('Erro ao desconectar', { description: error.message });
    }
  };

  // Excluir instância: remove no Evolution API quando possível e no backend
  const confirmDelete = async () => {
    if (!connectionToDelete) return;
    setIsDeleting(true);
    try {
      const name = connectionToDelete.instance_name;
      const candidates: Array<{ endpoint: string; method: 'DELETE' | 'POST' }> = [
        { endpoint: API_ENDPOINTS.INSTANCE_DELETE(name), method: 'DELETE' },
        { endpoint: API_ENDPOINTS.INSTANCE_DELETE(name), method: 'POST' },
        { endpoint: `/instance/delete/${name}`, method: 'DELETE' },
        { endpoint: `/instance/remove/${name}`, method: 'DELETE' },
      ];
      for (const c of candidates) {
        try {
          await evolutionApiRequest<any>(c.endpoint, { method: c.method, suppressToast: true, suppressInfoToast: true });
          break;
        } catch (_) {
          // tenta próximo
        }
      }
      await dbClient.connections.delete(connectionToDelete.id);
      toast.success('Instância excluída.');
      setIsDeleteDialogOpen(false);
      setConnectionToDelete(null);
      await fetchConnections();
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
    
    try {
      const createPayloadTemplate = import.meta.env.VITE_EVOLUTION_CREATE_PAYLOAD_TEMPLATE as string | undefined;
      let createPayload: EvolutionInstanceCreateRequest = {
        instanceName: newConnectionName,
        token: newConnectionName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookUrlEnv || `${window.location.origin}/api/whatsapp/webhook`,
          byEvents: true,
          base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
          headers: { 'x-user-id': user?.id || '' },
        },
      };

      if (createPayloadTemplate) {
        try {
          const replaced = createPayloadTemplate.split('{instanceName}').join(newConnectionName);
          const parsed = JSON.parse(replaced);
          createPayload = parsed as EvolutionInstanceCreateRequest;
        } catch (e) {
          // Mantém payload padrão se o template não for válido
        }
      }

      const createEndpoints = [
        API_ENDPOINTS.INSTANCE_CREATE,
        '/instances/create',
        '/instance',
        '/whatsapp/instance/create',
        '/whatsapp/create-instance',
      ];

      let creationResponse: EvolutionInstanceCreateResponse | null = null;
      for (const ep of createEndpoints) {
        const res = await evolutionApiRequest<EvolutionInstanceCreateResponse>(ep, {
          method: 'POST',
          body: JSON.stringify(createPayload),
          suppressToast: true,
          suppressInfoToast: true,
        });
        if (res) {
          creationResponse = res;
          break;
        }
      }

      if (!creationResponse) {
        throw new Error("A Evolution API não respondeu à criação da instância.");
      }

      // Salvar no backend com status inicial DISCONNECTED
      await dbClient.connections.create({
        instance_name: newConnectionName,
        status: 'DISCONNECTED',
        user_id: user.id,
        instance_data: creationResponse,
      });

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

  const startStatusPolling = (connection: Connection) => {
    const intervalMs = 2000;
    const timeoutMs = 120000; // 2 minutos
    const startTs = Date.now();

    const poll = async () => {
      const statusCandidates: string[] = [
        API_ENDPOINTS.INSTANCE_STATUS(connection.instance_name),
        `/instance/status/${connection.instance_name}`,
        `/instance/connectionState/${connection.instance_name}`,
        `/instance/check/${connection.instance_name}`,
        `/instance/fetchInstances/${connection.instance_name}`,
        `/instance/fetchInstances`,
      ];

      let res: any = null;
      let status: string | null = null;
      for (const endpoint of statusCandidates) {
        const attempt = await evolutionApiRequest<any>(endpoint, { method: 'GET', suppressToast: true, suppressInfoToast: true });
        if (attempt) {
          const s = resolveStatusFromResponse(attempt, connection.instance_name);
          if (s) {
            res = attempt;
            status = s;
            break;
          }
        }
      }

      const normalized = normalizeStatus(status, res);

      // Atualiza badge em tempo real durante o polling
      if (normalized) {
          const locked = !!disconnectLockRef.current[connection.instance_name];
          const effective = locked && normalized === 'CONNECTED' ? 'DISCONNECTED' : normalized;
          setConnections(prev => prev.map(c => c.id === connection.id ? { ...c, status: effective } : c));
        }

      if (normalized === 'CONNECTED') {
        const locked = !!disconnectLockRef.current[connection.instance_name];
        if (locked) {
          try { await enforceStop(connection.instance_name); } catch (_) {}
          // Não promove para CONNECTED enquanto bloqueado; continua polling
        } else {
          try {
            // Atualiza backend e fecha modal
            await dbClient.connections.update(connection.id, { status: 'CONNECTED', instance_data: res });
            toast.success('Conectado com sucesso!');
            setIsQrModalOpen(false);
            setQrCodeData('');
            setPairingCode('');
            await fetchConnections();
            // Sincroniza conversas imediatamente após conexão
            const alreadySynced = !!connectedNotifiedRef.current[connection.id];
            if (!alreadySynced) {
              try {
                toast.info('Sincronizando últimas conversas...');
                await dbClient.evolution.syncChats({ connection_id: connection.id, limit: 10 });
                connectedNotifiedRef.current[connection.id] = true;
              } catch (e: any) {
                toast.error('Erro ao sincronizar conversas', { description: e.message });
              }
            }
          } catch (e: any) {
            toast.error('Erro ao atualizar status para conectado', { description: e.message });
          } finally {
            setIsConnecting(false);
          }
          if (statusPollRef.current) {
            clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
          return;
        }
      }
      if (Date.now() - startTs > timeoutMs) {
        toast.error('Tempo limite para conexão. Tente novamente.');
        setIsConnecting(false);
        if (statusPollRef.current) {
          clearInterval(statusPollRef.current);
          statusPollRef.current = null;
        }
      }
    };

    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
    // Dispara uma verificação imediata para reduzir latência percebida
    poll().catch(() => {});
    // Agenda polling periódico
    statusPollRef.current = window.setInterval(() => {
      poll().catch(() => {});
    }, intervalMs);
  };

  // Pausar conexão
  const handlePause = async (connection: Connection) => {
    try {
      const candidates: Array<{ endpoint: string; method: 'POST'; body?: string }> = [
        { endpoint: `/instance/pause/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/suspend/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/stop/${connection.instance_name}`, method: 'POST' },
        { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), method: 'POST', body: JSON.stringify({ pause: true }) },
      ];
      let success = false;
      for (const c of candidates) {
        try {
          await evolutionApiRequest<any>(c.endpoint, { method: c.method, ...(c.body ? { body: c.body } : {}), suppressToast: true, suppressInfoToast: true });
          success = true;
          break;
        } catch (_) {
          // tenta próximo
        }
      }
      if (!success) {
        throw new Error('Falha ao pausar em todas as rotas.');
      }
      await dbClient.connections.update(connection.id, { status: 'PAUSED' });
      toast.success('Instância pausada.');
      await fetchConnections();
    } catch (error: any) {
      toast.error('Erro ao pausar', { description: error.message });
    }
  };

  // Retomar conexão
  const handleResume = async (connection: Connection) => {
    try {
      // Retomar é uma ação explícita: remove bloqueio de reconexão
      disconnectLockRef.current[connection.instance_name] = false;
      const candidates: Array<{ endpoint: string; method: 'GET' | 'POST' }> = [
        { endpoint: `/instance/resume/${connection.instance_name}`, method: 'POST' },
        { endpoint: `/instance/start/${connection.instance_name}`, method: 'POST' },
        { endpoint: API_ENDPOINTS.INSTANCE_CONNECT(connection.instance_name), method: 'GET' },
      ];
      let success = false;
      for (const c of candidates) {
        try {
          await evolutionApiRequest<any>(c.endpoint, { method: c.method, suppressToast: true, suppressInfoToast: true });
          success = true;
          break;
        } catch (_) {
          // tenta próximo
        }
      }
      if (success) {
        await dbClient.connections.update(connection.id, { status: 'INITIALIZING' });
        toast.success('Instância retomando...');
        startStatusPolling(connection);
      } else {
        throw new Error('Nenhuma rota de retomada funcionou.');
      }
    } catch (error: any) {
      toast.error('Erro ao retomar', { description: error.message });
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
                    <div key={connection.id} className="p-4 flex flex-col space-y-3 hover:bg-accent/50">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <p className="font-semibold">{connection.instance_name}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
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
                          <>
                            <Button variant="destructive" size="sm" onClick={() => handleDisconnect(connection)}>
                              Desconectar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handlePause(connection)}>
                              Pausar
                            </Button>
                          </>
                        )}
                        {uiStatus === 'paused' && (
                          <>
                            <Button variant="default" size="sm" onClick={() => handleResume(connection)}>
                              Retomar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDisconnect(connection)}>
                              Desconectar
                            </Button>
                          </>
                        )}
                        {uiStatus === 'connecting' && (
                          <Button variant="outline" size="sm" disabled>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Conectando...
                          </Button>
                        )}
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
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Criar Nova Conexão">
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
            <p className="mt-2 text-sm text-muted-foreground">
              Crie uma nova instância do WhatsApp. Use apenas letras minúsculas, números e underscores.
            </p>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInstance} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Instância
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal do QR Code */}
      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Conectar WhatsApp">
        <div className="text-sm text-muted-foreground mb-2">
          {selectedConnection?.instance_name && `Instância: ${selectedConnection.instance_name}`}
        </div>
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
        <div className="flex items-center justify-end mt-4">
          <Button variant="outline" onClick={() => setIsQrModalOpen(false)}>
            Fechar
          </Button>
        </div>
      </Modal>

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
