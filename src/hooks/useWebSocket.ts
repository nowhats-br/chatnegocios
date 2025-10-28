import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface WebSocketMessage {
  conversationId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  messageId: string;
  content: string;
  messageType: string;
  timestamp: string;
}

interface ConnectionUpdate {
  instanceName: string;
  status: string;
  data?: any;
}

interface QRCodeUpdate {
  instanceName: string;
  qrcode?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  // Callbacks para eventos
  const [onNewMessage, setOnNewMessage] = useState<((message: WebSocketMessage) => void) | null>(null);
  const [onConnectionUpdate, setOnConnectionUpdate] = useState<((update: ConnectionUpdate) => void) | null>(null);
  const [onQRCodeUpdate, setOnQRCodeUpdate] = useState<((update: QRCodeUpdate) => void) | null>(null);

  const connect = useCallback(() => {
    if (!user?.id) {
      console.log('[WebSocket] Usuário não autenticado, não conectando');
      return;
    }

    if (socketRef.current?.connected) {
      console.log('[WebSocket] Já conectado');
      return;
    }

    console.log('[WebSocket] Iniciando conexão...');
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] ✅ Conectado ao servidor');
      setIsConnected(true);
      setConnectionError(null);
      
      // Registrar usuário
      socket.emit('register', user.id);
    });

    socket.on('registered', (data) => {
      console.log('[WebSocket] ✅ Usuário registrado:', data);
      toast.success('Conexão em tempo real ativada!');
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] ❌ Desconectado:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Reconectar se o servidor desconectou
        setTimeout(() => {
          console.log('[WebSocket] Tentando reconectar...');
          socket.connect();
        }, 2000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ Erro de conexão:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      toast.error('Erro na conexão em tempo real', { 
        description: 'Tentando reconectar...' 
      });
    });

    // Eventos específicos do WhatsApp
    socket.on('new_message', (message: WebSocketMessage) => {
      console.log('[WebSocket] 📨 Nova mensagem recebida:', message);
      
      if (onNewMessage) {
        onNewMessage(message);
      }
      
      // Mostrar notificação
      toast.info(`Nova mensagem de ${message.contactName}`, {
        description: message.content.substring(0, 100),
        action: {
          label: 'Ver',
          onClick: () => {
            // Aqui poderia navegar para a conversa
            console.log('Navegar para conversa:', message.conversationId);
          }
        }
      });
    });

    socket.on('connection_update', (update: ConnectionUpdate) => {
      console.log('[WebSocket] 🔄 Atualização de conexão:', update);
      
      if (onConnectionUpdate) {
        onConnectionUpdate(update);
      }
      
      const statusMessages = {
        'CONNECTED': 'WhatsApp conectado',
        'DISCONNECTED': 'WhatsApp desconectado',
        'INITIALIZING': 'WhatsApp inicializando...',
        'WAITING_QR_CODE': 'Aguardando QR Code'
      };
      
      const message = statusMessages[update.status as keyof typeof statusMessages] || `Status: ${update.status}`;
      
      if (update.status === 'CONNECTED') {
        toast.success(message, { description: `Instância: ${update.instanceName}` });
      } else if (update.status === 'DISCONNECTED') {
        toast.error(message, { description: `Instância: ${update.instanceName}` });
      } else {
        toast.info(message, { description: `Instância: ${update.instanceName}` });
      }
    });

    socket.on('qrcode_update', (update: QRCodeUpdate) => {
      console.log('[WebSocket] 📱 Atualização de QR Code:', update);
      
      if (onQRCodeUpdate) {
        onQRCodeUpdate(update);
      }
      
      toast.info('QR Code atualizado', { 
        description: `Escaneie o QR Code para ${update.instanceName}` 
      });
    });

  }, [user?.id, onNewMessage, onConnectionUpdate, onQRCodeUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Desconectando...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectionError(null);
    }
  }, []);

  // Configurar webhook automaticamente para instâncias conectadas
  const setupWebhookForInstance = useCallback(async (instanceName: string) => {
    if (!user?.id) return;

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      
      const response = await fetch(`${backendUrl}/api/whatsapp/setup-webhook/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[WebSocket] ✅ Webhook configurado para ${instanceName}:`, data);
        toast.success(`Webhook configurado para ${instanceName}`);
        return true;
      } else {
        const error = await response.json();
        console.error(`[WebSocket] ❌ Erro ao configurar webhook para ${instanceName}:`, error);
        toast.error(`Erro ao configurar webhook para ${instanceName}`, { 
          description: error.error 
        });
        return false;
      }
    } catch (error) {
      console.error(`[WebSocket] ❌ Erro ao configurar webhook para ${instanceName}:`, error);
      toast.error(`Erro ao configurar webhook para ${instanceName}`);
      return false;
    }
  }, [user?.id]);

  // Conectar automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    if (user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    setupWebhookForInstance,
    // Setters para callbacks
    setOnNewMessage: useCallback((callback: (message: WebSocketMessage) => void) => {
      setOnNewMessage(() => callback);
    }, []),
    setOnConnectionUpdate: useCallback((callback: (update: ConnectionUpdate) => void) => {
      setOnConnectionUpdate(() => callback);
    }, []),
    setOnQRCodeUpdate: useCallback((callback: (update: QRCodeUpdate) => void) => {
      setOnQRCodeUpdate(() => callback);
    }, []),
  };
}