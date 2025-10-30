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
  correlationId?: string;
  requiresAck?: boolean;
  retryCount?: number;
  isRetry?: boolean;
  sender_is_user?: boolean;
  isNewConversation?: boolean;
  ticketInfo?: {
    shouldCreateTicket?: boolean;
    priority?: string;
    category?: string;
  };
}

interface BatchedMessage {
  event: string;
  data: WebSocketMessage | ConnectionUpdate | QRCodeUpdate | any;
  timestamp: number;
}

interface MessageBatch {
  messages: BatchedMessage[];
  batchId: string;
  timestamp: string;
  totalMessages: number;
}

interface ConnectionUpdate {
  instanceName: string;
  status: string;
  data?: any;
  correlationId?: string;
  requiresAck?: boolean;
  messageId?: string;
}

interface QRCodeUpdate {
  instanceName: string;
  qrcode?: string;
  correlationId?: string;
  requiresAck?: boolean;
  messageId?: string;
}

interface ReconnectionState {
  isReconnecting: boolean;
  attempts: number;
  maxAttempts: number;
  nextRetryIn: number;
  lastError: string | null;
  backoffDelay: number;
  baseDelay: number;
  maxDelay: number;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('disconnected');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectionState, setReconnectionState] = useState<ReconnectionState>({
    isReconnecting: false,
    attempts: 0,
    maxAttempts: 10,
    nextRetryIn: 0,
    lastError: null,
    backoffDelay: 1000,
    baseDelay: 1000,
    maxDelay: 30000
  });
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  
  // Track processed messages to prevent duplicates
  const processedMessagesRef = useRef<Set<string>>(new Set());
  
  // Heartbeat tracking
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatStartTimeRef = useRef<number | null>(null);
  
  // Connection quality tracking
  const latencyHistoryRef = useRef<number[]>([]);
  const maxLatencyHistory = 10;

  // Reconnection management
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectionCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);

  // Enhanced callback management using refs to prevent stale closures
  const onNewMessageRef = useRef<((message: WebSocketMessage) => void) | null>(null);
  const onConnectionUpdateRef = useRef<((update: ConnectionUpdate) => void) | null>(null);
  const onQRCodeUpdateRef = useRef<((update: QRCodeUpdate) => void) | null>(null);
  const onSyncCompleteRef = useRef<((data: any) => void) | null>(null);

  // Function to send acknowledgment for received messages
  const sendAcknowledgment = useCallback((messageId: string, correlationId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message_ack', {
        messageId,
        correlationId,
        timestamp: new Date().toISOString()
      });
      
      console.log('[WebSocket] ✅ Acknowledgment sent:', { messageId, correlationId });
    } else {
      console.warn('[WebSocket] ⚠️ Cannot send acknowledgment, not connected:', messageId);
    }
  }, []);

  // Function to check if message was already processed (deduplication)
  const isMessageProcessed = useCallback((messageId: string): boolean => {
    return processedMessagesRef.current.has(messageId);
  }, []);

  // Function to mark message as processed
  const markMessageAsProcessed = useCallback((messageId: string) => {
    processedMessagesRef.current.add(messageId);
    
    // Clean up old processed messages (keep only last 1000)
    if (processedMessagesRef.current.size > 1000) {
      const messagesArray = Array.from(processedMessagesRef.current);
      const toKeep = messagesArray.slice(-500); // Keep last 500
      processedMessagesRef.current.clear();
      toKeep.forEach(id => processedMessagesRef.current.add(id));
    }
  }, []);

  // Function to update connection quality based on latency
  const updateConnectionQuality = useCallback((latency: number) => {
    // Add latency to history
    latencyHistoryRef.current.push(latency);
    if (latencyHistoryRef.current.length > maxLatencyHistory) {
      latencyHistoryRef.current.shift();
    }
    
    // Calculate average latency
    const avgLatency = latencyHistoryRef.current.reduce((sum, lat) => sum + lat, 0) / latencyHistoryRef.current.length;
    
    // Determine connection quality based on average latency
    let quality: 'good' | 'poor' | 'disconnected';
    if (avgLatency < 1000) { // Less than 1 second
      quality = 'good';
    } else if (avgLatency < 3000) { // Less than 3 seconds
      quality = 'poor';
    } else {
      quality = 'poor'; // Very high latency
    }
    
    setConnectionQuality(quality);
    
    console.log('[WebSocket] 📊 Connection quality updated:', {
      currentLatency: `${latency}ms`,
      averageLatency: `${Math.round(avgLatency)}ms`,
      quality,
      samples: latencyHistoryRef.current.length
    });
  }, []);

  // Enhanced reconnection with exponential backoff
  const scheduleReconnection = useCallback((error?: string) => {
    if (isManualDisconnectRef.current) {
      console.log('[WebSocket] 🚫 Manual disconnect, skipping reconnection');
      return;
    }

    setReconnectionState(prev => {
      const newAttempts = prev.attempts + 1;
      
      // Check if max attempts reached
      if (newAttempts > prev.maxAttempts) {
        console.log('[WebSocket] ❌ Max reconnection attempts reached, giving up');
        toast.error('Conexão perdida', {
          description: `Não foi possível reconectar após ${prev.maxAttempts} tentativas. Recarregue a página.`,
          action: {
            label: 'Recarregar',
            onClick: () => window.location.reload()
          }
        });
        
        return {
          ...prev,
          isReconnecting: false,
          lastError: error || 'Max attempts reached'
        };
      }

      // Calculate exponential backoff delay
      const backoffDelay = Math.min(
        prev.baseDelay * Math.pow(2, newAttempts - 1),
        prev.maxDelay
      );

      console.log(`[WebSocket] 🔄 Scheduling reconnection attempt ${newAttempts}/${prev.maxAttempts} in ${backoffDelay}ms`);
      
      // Show user notification about reconnection
      if (newAttempts === 1) {
        toast.info('Conexão perdida', {
          description: 'Tentando reconectar...'
        });
      } else if (newAttempts <= 3) {
        toast.info(`Tentativa ${newAttempts}`, {
          description: `Reconectando em ${Math.round(backoffDelay / 1000)}s...`
        });
      }

      const newState = {
        ...prev,
        isReconnecting: true,
        attempts: newAttempts,
        backoffDelay,
        nextRetryIn: backoffDelay,
        lastError: error || null
      };

      // Clear any existing reconnection timeout
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
      }

      // Clear any existing countdown
      if (reconnectionCountdownRef.current) {
        clearInterval(reconnectionCountdownRef.current);
      }

      // Start countdown for user feedback
      let remainingTime = backoffDelay;
      reconnectionCountdownRef.current = setInterval(() => {
        remainingTime -= 1000;
        if (remainingTime > 0) {
          setReconnectionState(current => ({
            ...current,
            nextRetryIn: remainingTime
          }));
        } else {
          if (reconnectionCountdownRef.current) {
            clearInterval(reconnectionCountdownRef.current);
            reconnectionCountdownRef.current = null;
          }
        }
      }, 1000);

      // Schedule the actual reconnection
      reconnectionTimeoutRef.current = setTimeout(() => {
        if (!socketRef.current?.connected && !isManualDisconnectRef.current) {
          console.log(`[WebSocket] 🔄 Executing reconnection attempt ${newAttempts}`);
          connect();
        }
      }, backoffDelay);

      return newState;
    });
  }, []);

  // Reset reconnection state on successful connection
  const resetReconnectionState = useCallback(() => {
    // Clear timeouts
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }
    if (reconnectionCountdownRef.current) {
      clearInterval(reconnectionCountdownRef.current);
      reconnectionCountdownRef.current = null;
    }

    setReconnectionState(prev => ({
      ...prev,
      isReconnecting: false,
      attempts: 0,
      nextRetryIn: 0,
      lastError: null,
      backoffDelay: prev.baseDelay
    }));
    
    setReconnectAttempts(0);
  }, []);

  // Manual reconnection function
  const forceReconnect = useCallback(() => {
    console.log('[WebSocket] 🔄 Manual reconnection requested');
    
    // Clear any existing reconnection state
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }
    if (reconnectionCountdownRef.current) {
      clearInterval(reconnectionCountdownRef.current);
      reconnectionCountdownRef.current = null;
    }

    // Reset reconnection state
    setReconnectionState(prev => ({
      ...prev,
      isReconnecting: false,
      attempts: 0,
      nextRetryIn: 0,
      lastError: null,
      backoffDelay: prev.baseDelay
    }));

    // Disconnect and reconnect
    if (socketRef.current) {
      isManualDisconnectRef.current = true;
      socketRef.current.disconnect();
      setTimeout(() => {
        isManualDisconnectRef.current = false;
        connect();
      }, 1000);
    } else {
      connect();
    }
  }, []);

  // Heartbeat management
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        // Set timeout for heartbeat response
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('[WebSocket] ⚠️ Client heartbeat timeout - connection quality poor');
          setConnectionQuality('poor');
          
          // Clear latency history on timeout
          latencyHistoryRef.current = [];
        }, 10000); // 10 second timeout for client heartbeat
        
        // Record heartbeat start time for latency calculation
        heartbeatStartTimeRef.current = Date.now();
        socketRef.current.emit('heartbeat');
        console.log('[WebSocket] 💓 Client heartbeat sent');
      }
    }, 30000); // Send heartbeat every 30 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

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
      setConnectionQuality('good');
      
      // Reset reconnection state on successful connection
      resetReconnectionState();
      
      // Clear latency history on new connection
      latencyHistoryRef.current = [];
      
      // Start heartbeat monitoring
      startHeartbeat();
      
      // Registrar usuário
      socket.emit('register', user.id);
    });

    socket.on('registered', (data) => {
      console.log('[WebSocket] ✅ Usuário registrado:', data);
      
      const wasReconnecting = reconnectionState.isReconnecting;
      const attemptCount = reconnectionState.attempts;
      
      if (wasReconnecting && attemptCount > 0) {
        toast.success('Conexão em tempo real restaurada!', {
          description: `Reconectado após ${attemptCount} tentativa${attemptCount > 1 ? 's' : ''}`
        });
      } else {
        toast.success('Conexão em tempo real ativada!', {
          description: `Heartbeat: ${data.heartbeatInterval ? Math.round(data.heartbeatInterval / 1000) : 30}s`
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] ❌ Desconectado:', reason);
      setIsConnected(false);
      setConnectionQuality('disconnected');
      setLastHeartbeat(null);
      
      // Stop heartbeat monitoring
      stopHeartbeat();
      
      // Clear latency history
      latencyHistoryRef.current = [];
      
      // Only attempt reconnection for certain disconnect reasons and if not manual disconnect
      const shouldReconnect = !isManualDisconnectRef.current && (
        reason === 'io server disconnect' || 
        reason === 'transport close' || 
        reason === 'transport error' ||
        reason === 'ping timeout'
      );
      
      if (shouldReconnect) {
        console.log(`[WebSocket] 🔄 Disconnect reason '${reason}' triggers reconnection`);
        scheduleReconnection(`Disconnected: ${reason}`);
      } else {
        console.log(`[WebSocket] 🚫 Disconnect reason '${reason}' does not trigger reconnection`);
        if (isManualDisconnectRef.current) {
          isManualDisconnectRef.current = false; // Reset flag
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ Erro de conexão:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      setConnectionQuality('disconnected');
      setLastHeartbeat(null);
      
      // Stop heartbeat monitoring
      stopHeartbeat();
      
      // Schedule reconnection on connection error
      if (!isManualDisconnectRef.current) {
        scheduleReconnection(`Connection error: ${error.message}`);
      }
    });

    // Handle heartbeat acknowledgment (client -> server -> client)
    socket.on('heartbeat_ack', (data) => {
      const now = new Date();
      setLastHeartbeat(now);
      
      // Calculate client-side latency
      let clientLatency = 0;
      if (heartbeatStartTimeRef.current) {
        clientLatency = Date.now() - heartbeatStartTimeRef.current;
        heartbeatStartTimeRef.current = null;
        
        // Update connection quality based on latency
        updateConnectionQuality(clientLatency);
      } else {
        // Fallback to good quality if we can't measure latency
        setConnectionQuality('good');
      }
      
      // Clear heartbeat timeout
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      
      console.log('[WebSocket] 💓 Client heartbeat acknowledged:', {
        serverTimestamp: data.timestamp,
        serverLatency: data.latency,
        clientLatency: `${clientLatency}ms`
      });
    });

    // Handle server heartbeat (server -> client)
    socket.on('server_heartbeat', (data) => {
      const now = new Date();
      setLastHeartbeat(now);
      setConnectionQuality('good');
      
      // Respond to server heartbeat
      socket.emit('server_heartbeat_response', {
        serverTimestamp: data.timestamp,
        clientTimestamp: now.toISOString(),
        serverId: data.serverId
      });
      
      console.log('[WebSocket] 💓 Server heartbeat received and responded:', {
        serverTimestamp: data.timestamp,
        serverId: data.serverId
      });
    });

    // Enhanced WebSocket event handlers with proper callback management
    socket.on('new_message', (message: WebSocketMessage) => {
      console.log('[WebSocket] 📨 Nova mensagem recebida:', message);
      
      // Check for message deduplication
      if (message.messageId && isMessageProcessed(message.messageId)) {
        console.log('[WebSocket] 🔄 Duplicate message ignored:', message.messageId);
        
        // Still send acknowledgment for duplicate messages
        if (message.requiresAck && message.messageId) {
          sendAcknowledgment(message.messageId, message.correlationId);
        }
        return;
      }
      
      // Mark message as processed
      if (message.messageId) {
        markMessageAsProcessed(message.messageId);
      }
      
      // Send acknowledgment if required
      if (message.requiresAck && message.messageId) {
        sendAcknowledgment(message.messageId, message.correlationId);
      }
      
      // Process the message using ref to avoid stale closures
      if (onNewMessageRef.current) {
        try {
          onNewMessageRef.current(message);
        } catch (error) {
          console.error('[WebSocket] Error in onNewMessage callback:', error);
        }
      }
      
      // Show notification (don't show for retries to avoid spam)
      if (!message.isRetry) {
        const retryText = message.retryCount && message.retryCount > 0 ? ` (tentativa ${message.retryCount + 1})` : '';
        toast.info(`Nova mensagem de ${message.contactName}${retryText}`, {
          description: message.content.substring(0, 100),
          action: {
            label: 'Ver',
            onClick: () => {
              // Aqui poderia navegar para a conversa
              console.log('Navegar para conversa:', message.conversationId);
            }
          }
        });
      }
    });

    // Handle batched messages for improved performance
    socket.on('message_batch', (batch: MessageBatch) => {
      console.log('[WebSocket] 📦 Lote de mensagens recebido:', {
        batchId: batch.batchId,
        totalMessages: batch.totalMessages,
        timestamp: batch.timestamp
      });

      let processedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      // Process each message in the batch
      for (const message of batch.messages) {
        try {
          // Check for message deduplication
          if (message.data.messageId && isMessageProcessed(message.data.messageId)) {
            console.log('[WebSocket] 🔄 Duplicate batched message ignored:', message.data.messageId);
            duplicateCount++;
            
            // Still send acknowledgment for duplicate messages
            if (message.data.requiresAck && message.data.messageId) {
              sendAcknowledgment(message.data.messageId, message.data.correlationId);
            }
            continue;
          }
          
          // Mark message as processed
          if (message.data.messageId) {
            markMessageAsProcessed(message.data.messageId);
          }
          
          // Send acknowledgment if required
          if (message.data.requiresAck && message.data.messageId) {
            sendAcknowledgment(message.data.messageId, message.data.correlationId);
          }
          
          // Process the message based on event type
          if (message.event === 'new_message' && onNewMessageRef.current) {
            onNewMessageRef.current(message.data as WebSocketMessage);
            processedCount++;
          } else if (message.event === 'connection_update' && onConnectionUpdateRef.current) {
            onConnectionUpdateRef.current(message.data as ConnectionUpdate);
            processedCount++;
          } else if (message.event === 'qrcode_update' && onQRCodeUpdateRef.current) {
            onQRCodeUpdateRef.current(message.data as QRCodeUpdate);
            processedCount++;
          } else if (message.event === 'sync_response' && onSyncCompleteRef.current) {
            onSyncCompleteRef.current(message.data);
            processedCount++;
          } else {
            console.warn('[WebSocket] ⚠️ Unknown batched event type:', message.event);
          }
        } catch (error) {
          console.error('[WebSocket] ❌ Error processing batched message:', error);
          errorCount++;
        }
      }

      console.log('[WebSocket] 📦 Batch processing completed:', {
        batchId: batch.batchId,
        totalMessages: batch.totalMessages,
        processedCount,
        duplicateCount,
        errorCount,
        successRate: `${Math.round((processedCount / batch.totalMessages) * 100)}%`
      });

      // Show batch notification if there are new messages
      if (processedCount > 0) {
        const newMessageCount = batch.messages.filter(m => m.event === 'new_message').length;
        if (newMessageCount > 0) {
          toast.info(`${newMessageCount} nova${newMessageCount > 1 ? 's' : ''} mensagem${newMessageCount > 1 ? 'ns' : ''}`, {
            description: `Recebidas em lote (${batch.totalMessages} total)`,
            action: {
              label: 'Ver',
              onClick: () => {
                console.log('Ver mensagens do lote:', batch.batchId);
              }
            }
          });
        }
      }
    });

    socket.on('connection_update', (update: ConnectionUpdate) => {
      console.log('[WebSocket] 🔄 Atualização de conexão:', update);
      
      // Send acknowledgment if required
      if (update.requiresAck && update.messageId) {
        sendAcknowledgment(update.messageId, update.correlationId);
      }
      
      // Process the update using ref to avoid stale closures
      if (onConnectionUpdateRef.current) {
        try {
          onConnectionUpdateRef.current(update);
        } catch (error) {
          console.error('[WebSocket] Error in onConnectionUpdate callback:', error);
        }
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
      
      // Send acknowledgment if required
      if (update.requiresAck && update.messageId) {
        sendAcknowledgment(update.messageId, update.correlationId);
      }
      
      // Process the update using ref to avoid stale closures
      if (onQRCodeUpdateRef.current) {
        try {
          onQRCodeUpdateRef.current(update);
        } catch (error) {
          console.error('[WebSocket] Error in onQRCodeUpdate callback:', error);
        }
      }
      
      toast.info('QR Code atualizado', { 
        description: `Escaneie o QR Code para ${update.instanceName}` 
      });
    });

    // Add sync response handler for manual sync operations
    socket.on('sync_response', (data: any) => {
      console.log('[WebSocket] 🔄 Sync response received:', data);
      
      // Send acknowledgment if required
      if (data.requiresAck && data.messageId) {
        sendAcknowledgment(data.messageId, data.correlationId);
      }
      
      // Process the sync response using ref to avoid stale closures
      if (onSyncCompleteRef.current) {
        try {
          onSyncCompleteRef.current(data);
        } catch (error) {
          console.error('[WebSocket] Error in onSyncComplete callback:', error);
        }
      }
    });

  }, [user?.id, resetReconnectionState, startHeartbeat, stopHeartbeat, scheduleReconnection, reconnectionState.isReconnecting, reconnectionState.attempts]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] 🔌 Manual disconnect requested');
      
      // Set manual disconnect flag to prevent automatic reconnection
      isManualDisconnectRef.current = true;
      
      // Clear any pending reconnection attempts
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
        reconnectionTimeoutRef.current = null;
      }
      if (reconnectionCountdownRef.current) {
        clearInterval(reconnectionCountdownRef.current);
        reconnectionCountdownRef.current = null;
      }
      
      // Reset reconnection state
      resetReconnectionState();
      
      stopHeartbeat();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectionError(null);
      setConnectionQuality('disconnected');
      setLastHeartbeat(null);
      
      // Clear processed messages on disconnect
      processedMessagesRef.current.clear();
      
      // Reset manual disconnect flag after a short delay
      setTimeout(() => {
        isManualDisconnectRef.current = false;
      }, 1000);
    }
  }, [stopHeartbeat, resetReconnectionState]);

  // Configurar webhook automaticamente para instâncias conectadas
  const setupWebhookForInstance = useCallback(async (instanceName: string) => {
    if (!user?.id) {
      console.error('[WebSocket] ❌ Usuário não autenticado para configurar webhook');
      return false;
    }

    console.log(`[WebSocket] 🔧 Configurando webhook para instância: ${instanceName}`);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
      const url = `${backendUrl}/api/whatsapp/setup-webhook/${instanceName}`;
      
      console.log(`[WebSocket] 📡 Fazendo requisição para: ${url}`);
      console.log(`[WebSocket] 👤 User ID: ${user.id}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ userId: user.id })
      });

      console.log(`[WebSocket] 📥 Resposta recebida: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[WebSocket] ✅ Webhook configurado para ${instanceName}:`, data);
        toast.success(`Webhook configurado para ${instanceName}`, {
          description: `URL: ${data.webhookUrl?.substring(0, 50)}...`
        });
        return true;
      } else {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error(`[WebSocket] ❌ Erro ao configurar webhook para ${instanceName}:`, error);
        toast.error(`Erro ao configurar webhook para ${instanceName}`, { 
          description: error.error || error.details || 'Erro desconhecido'
        });
        return false;
      }
    } catch (error) {
      console.error(`[WebSocket] ❌ Erro fatal ao configurar webhook para ${instanceName}:`, error);
      toast.error(`Erro ao configurar webhook para ${instanceName}`, {
        description: error instanceof Error ? error.message : 'Erro de conexão'
      });
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
      // Clear reconnection timeouts
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
      }
      if (reconnectionCountdownRef.current) {
        clearInterval(reconnectionCountdownRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    connectionQuality,
    lastHeartbeat,
    reconnectAttempts,
    reconnectionState,
    connect,
    disconnect,
    forceReconnect,
    setupWebhookForInstance,
    sendAcknowledgment,
    // Enhanced callback setters using refs to prevent stale closures
    setOnNewMessage: useCallback((callback: (message: WebSocketMessage) => void) => {
      onNewMessageRef.current = callback;
    }, []),
    setOnConnectionUpdate: useCallback((callback: (update: ConnectionUpdate) => void) => {
      onConnectionUpdateRef.current = callback;
    }, []),
    setOnQRCodeUpdate: useCallback((callback: (update: QRCodeUpdate) => void) => {
      onQRCodeUpdateRef.current = callback;
    }, []),
    setOnSyncComplete: useCallback((callback: (data: any) => void) => {
      onSyncCompleteRef.current = callback;
    }, []),
    // Manual sync trigger function
    requestSync: useCallback((lastSyncTimestamp?: string) => {
      if (socketRef.current?.connected && user?.id) {
        const correlationId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        socketRef.current.emit('sync_request', {
          userId: user.id,
          lastSyncTimestamp,
          correlationId,
          timestamp: new Date().toISOString()
        });
        console.log('[WebSocket] 🔄 Sync request sent:', { lastSyncTimestamp, correlationId });
        return correlationId;
      } else {
        console.warn('[WebSocket] Cannot request sync: not connected or no user');
        return null;
      }
    }, [user?.id]),
  };
}