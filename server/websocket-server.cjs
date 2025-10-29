const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

// Verificação Crítica de Variáveis de Ambiente
const SUPABASE_AVAILABLE = /^https?:\/\//.test(process.env.SUPABASE_URL || '') && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_AVAILABLE) {
  console.warn('\x1b[33m[WARN]\x1b[0m Variáveis do Supabase não definidas. Webhook de persistência desabilitado.');
}

const PORT = Number(process.env.PORT) || 3002;
const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configuração de CORS para Express
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

const corsOptions = process.env.CORS_ALLOW_ALL === 'true'
  ? { origin: true, credentials: true }
  : {
    origin: (origin, callback) => {
      // Durante desenvolvimento, permitir requisições sem origin (como fetch do mesmo servidor)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Bloqueada origem não permitida: ${origin}`);
        console.warn(`[CORS] Origens permitidas:`, allowedOrigins);
        // Durante desenvolvimento, permitir mesmo assim
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          console.warn(`[CORS] Permitindo origem localhost para desenvolvimento: ${origin}`);
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
  };

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));

// Cliente Admin do Supabase
const supabaseAdmin = SUPABASE_AVAILABLE ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;

// Configurações da Evolution API
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Mapa de usuários conectados via WebSocket
const connectedUsers = new Map();

// Enhanced logging system with correlation IDs
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  generateCorrelationId() {
    return crypto.randomBytes(8).toString('hex');
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, category, message, correlationId = null, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      message,
      ...(correlationId && { correlationId }),
      ...metadata
    };

    const colorMap = {
      error: '\x1b[31m',
      warn: '\x1b[33m', 
      info: '\x1b[32m',
      debug: '\x1b[36m'
    };
    const color = colorMap[level] || '';
    const reset = '\x1b[0m';

    return `${color}[${timestamp}] [${level.toUpperCase()}] [${category}]${reset} ${message}${correlationId ? ` (ID: ${correlationId})` : ''}${Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : ''}`;
  }

  log(level, category, message, correlationId = null, metadata = {}) {
    if (this.shouldLog(level)) {
      console.log(this.formatMessage(level, category, message, correlationId, metadata));
    }
  }

  error(category, message, correlationId = null, metadata = {}) {
    this.log('error', category, message, correlationId, metadata);
  }

  warn(category, message, correlationId = null, metadata = {}) {
    this.log('warn', category, message, correlationId, metadata);
  }

  info(category, message, correlationId = null, metadata = {}) {
    this.log('info', category, message, correlationId, metadata);
  }

  debug(category, message, correlationId = null, metadata = {}) {
    this.log('debug', category, message, correlationId, metadata);
  }
}

const logger = new Logger();

// WebSocket connection tracking with detailed status
class ConnectionTracker {
  constructor() {
    this.connections = new Map();
    this.messageStats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      acknowledged: 0
    };
  }

  addConnection(userId, socketId, socket) {
    const connectionInfo = {
      userId,
      socketId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messagesSent: 0,
      messagesReceived: 0,
      status: 'connected',
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      ip: socket.handshake.address || 'unknown'
    };
    
    this.connections.set(userId, connectionInfo);
    logger.info('WebSocket', `User connected: ${userId}`, null, connectionInfo);
    return connectionInfo;
  }

  updateActivity(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
      this.connections.set(userId, connection);
    }
  }

  incrementMessagesSent(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.messagesSent++;
      this.updateActivity(userId);
      this.messageStats.sent++;
    }
  }

  incrementMessagesReceived(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.messagesReceived++;
      this.updateActivity(userId);
    }
  }

  removeConnection(userId) {
    const connection = this.connections.get(userId);
    if (connection) {
      const duration = Date.now() - new Date(connection.connectedAt).getTime();
      logger.info('WebSocket', `User disconnected: ${userId}`, null, {
        ...connection,
        sessionDuration: `${Math.round(duration / 1000)}s`
      });
      this.connections.delete(userId);
    }
  }

  getConnectionInfo(userId) {
    return this.connections.get(userId);
  }

  getAllConnections() {
    return Array.from(this.connections.values());
  }

  getStats() {
    return {
      activeConnections: this.connections.size,
      messageStats: this.messageStats,
      connections: this.getAllConnections()
    };
  }
}

const connectionTracker = new ConnectionTracker();

// Configuração do WebSocket com logging aprimorado
io.on('connection', (socket) => {
  const correlationId = logger.generateCorrelationId();
  
  logger.info('WebSocket', `Client connected: ${socket.id}`, correlationId, {
    socketId: socket.id,
    userAgent: socket.handshake.headers['user-agent'],
    ip: socket.handshake.address
  });

  // Registrar usuário
  socket.on('register', (userId) => {
    const registerCorrelationId = logger.generateCorrelationId();
    
    if (userId) {
      // Remove previous connection if exists
      if (connectedUsers.has(userId)) {
        const oldSocketId = connectedUsers.get(userId);
        logger.warn('WebSocket', `User ${userId} already connected, replacing connection`, registerCorrelationId, {
          oldSocketId,
          newSocketId: socket.id
        });
      }

      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      
      // Track connection details
      connectionTracker.addConnection(userId, socket.id, socket);
      
      logger.info('WebSocket', `User registered successfully: ${userId}`, registerCorrelationId, {
        userId,
        socketId: socket.id,
        totalConnections: connectedUsers.size
      });
      
      // Confirmar registro
      socket.emit('registered', { 
        userId, 
        socketId: socket.id,
        correlationId: registerCorrelationId,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.error('WebSocket', 'Registration failed: userId is required', registerCorrelationId, {
        socketId: socket.id
      });
      socket.emit('registration_error', { 
        error: 'userId is required',
        correlationId: registerCorrelationId
      });
    }
  });

  // Handle heartbeat
  socket.on('heartbeat', () => {
    if (socket.userId) {
      connectionTracker.updateActivity(socket.userId);
      connectionTracker.incrementMessagesReceived(socket.userId);
      socket.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
      logger.debug('WebSocket', `Heartbeat received from user: ${socket.userId}`, null, {
        userId: socket.userId,
        socketId: socket.id
      });
    }
  });

  // Handle message acknowledgment
  socket.on('message_ack', (data) => {
    if (socket.userId && data.messageId) {
      connectionTracker.messageStats.acknowledged++;
      logger.debug('WebSocket', `Message acknowledged: ${data.messageId}`, data.correlationId, {
        userId: socket.userId,
        messageId: data.messageId
      });
    }
  });

  // Desconexão
  socket.on('disconnect', (reason) => {
    const disconnectCorrelationId = logger.generateCorrelationId();
    
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      connectionTracker.removeConnection(socket.userId);
      
      logger.info('WebSocket', `User disconnected: ${socket.userId}`, disconnectCorrelationId, {
        userId: socket.userId,
        socketId: socket.id,
        reason,
        remainingConnections: connectedUsers.size
      });
    } else {
      logger.info('WebSocket', `Unregistered client disconnected: ${socket.id}`, disconnectCorrelationId, {
        socketId: socket.id,
        reason
      });
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    const errorCorrelationId = logger.generateCorrelationId();
    logger.error('WebSocket', `Socket error for ${socket.userId || socket.id}`, errorCorrelationId, {
      userId: socket.userId,
      socketId: socket.id,
      error: error.message,
      stack: error.stack
    });
  });
});

// Enhanced function to notify user via WebSocket with delivery tracking
function notifyUser(userId, event, data, correlationId = null) {
  const notifyCorrelationId = correlationId || logger.generateCorrelationId();
  const socketId = connectedUsers.get(userId);
  
  if (socketId) {
    try {
      // Add correlation ID and timestamp to message
      const enhancedData = {
        ...data,
        correlationId: notifyCorrelationId,
        timestamp: new Date().toISOString(),
        requiresAck: true
      };

      io.to(socketId).emit(event, enhancedData);
      
      connectionTracker.incrementMessagesSent(userId);
      connectionTracker.messageStats.delivered++;
      
      logger.info('WebSocket', `Event '${event}' sent to user: ${userId}`, notifyCorrelationId, {
        userId,
        socketId,
        event,
        dataSize: JSON.stringify(data).length,
        messageId: data.messageId || 'unknown'
      });
      
      return { success: true, correlationId: notifyCorrelationId };
    } catch (error) {
      connectionTracker.messageStats.failed++;
      logger.error('WebSocket', `Failed to send event '${event}' to user: ${userId}`, notifyCorrelationId, {
        userId,
        socketId,
        event,
        error: error.message
      });
      return { success: false, error: error.message, correlationId: notifyCorrelationId };
    }
  } else {
    connectionTracker.messageStats.failed++;
    logger.warn('WebSocket', `User not connected, cannot send event '${event}': ${userId}`, notifyCorrelationId, {
      userId,
      event,
      totalConnectedUsers: connectedUsers.size
    });
    return { success: false, error: 'User not connected', correlationId: notifyCorrelationId };
  }
}

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check with enhanced logging
app.get('/api/health', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Health', 'Health check requested', correlationId);
  
  const healthData = {
    ok: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    evolutionApiUrl: EVOLUTION_API_URL ? 'configurada' : 'não configurada',
    evolutionApiKey: EVOLUTION_API_KEY ? 'configurada' : 'não configurada',
    port: PORT,
    websocket: 'enabled',
    connectedUsers: connectedUsers.size,
    supabase: SUPABASE_AVAILABLE ? 'disponível' : 'indisponível',
    correlationId
  };
  
  logger.info('Health', 'Health check response sent', correlationId, healthData);
  res.json(healthData);
});

// Enhanced debug endpoints for WebSocket monitoring
app.get('/api/debug/websocket/connections', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket connections status requested', correlationId);
  
  const stats = connectionTracker.getStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    summary: {
      totalConnections: stats.activeConnections,
      messageStats: stats.messageStats
    },
    connections: stats.connections.map(conn => ({
      userId: conn.userId,
      socketId: conn.socketId,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      messagesSent: conn.messagesSent,
      messagesReceived: conn.messagesReceived,
      status: conn.status,
      sessionDuration: Math.round((Date.now() - new Date(conn.connectedAt).getTime()) / 1000) + 's',
      userAgent: conn.userAgent,
      ip: conn.ip
    }))
  };
  
  logger.info('Debug', 'WebSocket connections status sent', correlationId, {
    totalConnections: stats.activeConnections,
    requestedBy: _req.ip
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/user/:userId', (req, res) => {
  const { userId } = req.params;
  const correlationId = logger.generateCorrelationId();
  
  logger.info('Debug', `WebSocket user status requested: ${userId}`, correlationId);
  
  const connectionInfo = connectionTracker.getConnectionInfo(userId);
  const isConnected = connectedUsers.has(userId);
  
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    userId,
    isConnected,
    socketId: connectedUsers.get(userId) || null,
    connectionDetails: connectionInfo || null
  };
  
  if (connectionInfo) {
    response.sessionDuration = Math.round((Date.now() - new Date(connectionInfo.connectedAt).getTime()) / 1000) + 's';
  }
  
  logger.info('Debug', `WebSocket user status sent: ${userId}`, correlationId, {
    isConnected,
    hasDetails: !!connectionInfo
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/stats', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket statistics requested', correlationId);
  
  const stats = connectionTracker.getStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    activeConnections: stats.activeConnections,
    messageStats: stats.messageStats,
    averageSessionDuration: stats.connections.length > 0 
      ? Math.round(stats.connections.reduce((acc, conn) => {
          return acc + (Date.now() - new Date(conn.connectedAt).getTime());
        }, 0) / stats.connections.length / 1000) + 's'
      : '0s',
    connectionsByStatus: stats.connections.reduce((acc, conn) => {
      acc[conn.status] = (acc[conn.status] || 0) + 1;
      return acc;
    }, {})
  };
  
  logger.info('Debug', 'WebSocket statistics sent', correlationId, response);
  res.json(response);
});

// Endpoint de debug para testar configuração
app.get('/api/debug/webhook-config', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'Webhook configuration requested', correlationId);
  
  const response = {
    correlationId,
    evolutionApiUrl: EVOLUTION_API_URL,
    evolutionApiKey: EVOLUTION_API_KEY ? '***configurada***' : 'não configurada',
    supabaseAvailable: SUPABASE_AVAILABLE,
    connectedUsers: connectedUsers.size,
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'não configurada (usando request host)',
    timestamp: new Date().toISOString()
  };
  
  logger.info('Debug', 'Webhook configuration sent', correlationId, response);
  res.json(response);
});

// Logging middleware for all API requests
app.use('/api', (req, res, next) => {
  const correlationId = logger.generateCorrelationId();
  req.correlationId = correlationId;
  
  logger.info('API', `${req.method} ${req.path}`, correlationId, {
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentLength: req.headers['content-length'] || 0
  });
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    logger.info('API', `Response ${req.method} ${req.path} - ${res.statusCode}`, correlationId, {
      statusCode: res.statusCode,
      responseSize: JSON.stringify(data).length
    });
    return originalJson.call(this, data);
  };
  
  next();
});

// Endpoint simples para testar comunicação
app.get('/api/test/ping', (req, res) => {
  const correlationId = req.correlationId || logger.generateCorrelationId();
  logger.info('Test', 'Ping received', correlationId);
  
  res.json({
    success: true,
    message: 'Pong! Servidor funcionando',
    timestamp: new Date().toISOString(),
    correlationId
  });
});

// Endpoint para testar conexão com Evolution API
app.get('/api/debug/test-evolution', async (req, res) => {
  const correlationId = req.correlationId || logger.generateCorrelationId();
  logger.info('Debug', 'Testing Evolution API connection', correlationId);

  if (!EVOLUTION_API_URL) {
    logger.error('Debug', 'EVOLUTION_API_URL not configured', correlationId);
    return res.status(500).json({
      success: false,
      error: 'EVOLUTION_API_URL não configurado no backend',
      correlationId
    });
  }

  if (!EVOLUTION_API_KEY) {
    logger.error('Debug', 'EVOLUTION_API_KEY not configured', correlationId);
    return res.status(500).json({
      success: false,
      error: 'EVOLUTION_API_KEY não configurado no backend',
      correlationId
    });
  }

  try {
    const testUrl = `${EVOLUTION_API_URL}/manager/findInstances`;
    logger.debug('Debug', `Testing Evolution API URL: ${testUrl}`, correlationId);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
        'X-API-Key': EVOLUTION_API_KEY,
        Authorization: `Bearer ${EVOLUTION_API_KEY}`,
      },
    });

    logger.info('Debug', `Evolution API response: ${response.status} ${response.statusText}`, correlationId, {
      status: response.status,
      statusText: response.statusText,
      url: testUrl
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      logger.info('Debug', 'Evolution API connection successful', correlationId);
      res.json({
        success: true,
        message: 'Conexão com Evolution API estabelecida com sucesso',
        status: response.status,
        data: data,
        correlationId
      });
    } else {
      const errorText = await response.text().catch(() => '');
      logger.error('Debug', `Evolution API returned error status: ${response.status}`, correlationId, {
        status: response.status,
        errorText
      });
      res.status(response.status).json({
        success: false,
        error: `Evolution API retornou status ${response.status}`,
        details: errorText,
        correlationId
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Debug', 'Failed to connect to Evolution API', correlationId, {
      error: msg,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(502).json({
      success: false,
      error: `Erro ao conectar com Evolution API: ${msg}`,
      correlationId
    });
  }
});

// Webhook para receber eventos da Evolution API com logging aprimorado
app.post('/api/whatsapp/webhook', async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  
  if (!supabaseAdmin) {
    logger.warn('Webhook', 'Supabase disabled, webhook processing skipped', correlationId);
    return res.status(200).json({ 
      ok: true, 
      warning: 'Supabase desabilitado no backend.',
      correlationId 
    });
  }

  try {
    const payload = req.body || {};
    const instanceName = payload.instance;
    const eventType = String(payload.event || '').toLowerCase();
    const ownerUserId = (
      req.headers['x-user-id'] ||
      (req.query && (req.query.uid || req.query.user_id || req.query.userId)) ||
      payload?.uid || payload?.user_id || payload?.userId
    );

    logger.info('Webhook', `Event received: ${eventType}`, correlationId, {
      eventType,
      instanceName,
      ownerUserId,
      payloadSize: JSON.stringify(payload).length,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    if (!ownerUserId) {
      logger.error('Webhook', `Critical error: user_id not found for instance '${instanceName}'`, correlationId, {
        instanceName,
        eventType,
        headers: Object.keys(req.headers),
        query: req.query
      });
      return res.status(400).json({ 
        error: 'x-user-id header ou uid query é obrigatório',
        correlationId 
      });
    }

    if (eventType === 'connection.update') {
      logger.debug('Webhook', 'Processing connection.update event', correlationId, {
        instanceName,
        ownerUserId,
        state: payload.data?.state
      });

      // Verificar status atual antes de atualizar
      const { data: currentConnection } = await supabaseAdmin
        .from('connections')
        .select('status')
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId)
        .single();

      // Se a conexão está pausada, não atualizar o status
      if (currentConnection?.status === 'PAUSED') {
        logger.info('Webhook', `Connection '${instanceName}' is paused, ignoring status update`, correlationId, {
          instanceName,
          ownerUserId,
          currentStatus: 'PAUSED'
        });
        return res.status(200).json({ 
          ok: true, 
          message: 'Status ignorado - conexão pausada',
          correlationId 
        });
      }

      const statusMap = {
        'open': 'CONNECTED',
        'close': 'DISCONNECTED',
        'connecting': 'INITIALIZING',
      };
      const newStatus = statusMap[payload.data?.state] || 'DISCONNECTED';
      
      // Só atualizar se o status realmente mudou
      if (currentConnection?.status !== newStatus) {
        const { error } = await supabaseAdmin
          .from('connections')
          .update({ status: newStatus, instance_data: payload.data })
          .eq('instance_name', instanceName)
          .eq('user_id', ownerUserId);
        
        if (error) {
          logger.error('Webhook', `Failed to update connection status for '${instanceName}'`, correlationId, {
            instanceName,
            ownerUserId,
            newStatus,
            error: error.message
          });
        } else {
          logger.info('Webhook', `Connection status updated: ${instanceName} -> ${newStatus}`, correlationId, {
            instanceName,
            ownerUserId,
            oldStatus: currentConnection?.status,
            newStatus
          });

          // Notificar via WebSocket
          const notifyResult = notifyUser(ownerUserId, 'connection_update', {
            instanceName,
            status: newStatus,
            data: payload.data
          }, correlationId);

          if (!notifyResult.success) {
            logger.warn('Webhook', 'Failed to notify user of connection update', correlationId, {
              instanceName,
              ownerUserId,
              error: notifyResult.error
            });
          }
        }
      } else {
        logger.debug('Webhook', `Connection status unchanged for '${instanceName}': ${newStatus}`, correlationId, {
          instanceName,
          ownerUserId,
          status: newStatus
        });
      }
    }

    else if (eventType === 'qrcode.updated') {
      logger.debug('Webhook', 'Processing qrcode.updated event', correlationId, {
        instanceName,
        ownerUserId,
        hasQrCode: !!payload.data?.qrcode
      });

      const { error } = await supabaseAdmin
        .from('connections')
        .update({ status: 'WAITING_QR_CODE' })
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId);
      
      if (error) {
        logger.error('Webhook', `Failed to update status to WAITING_QR_CODE for '${instanceName}'`, correlationId, {
          instanceName,
          ownerUserId,
          error: error.message
        });
      } else {
        logger.info('Webhook', `QR Code status updated for '${instanceName}'`, correlationId, {
          instanceName,
          ownerUserId
        });

        // Notificar via WebSocket
        const notifyResult = notifyUser(ownerUserId, 'qrcode_update', {
          instanceName,
          qrcode: payload.data?.qrcode
        }, correlationId);

        if (!notifyResult.success) {
          logger.warn('Webhook', 'Failed to notify user of QR code update', correlationId, {
            instanceName,
            ownerUserId,
            error: notifyResult.error
          });
        }
      }
    }

    else if (eventType === 'messages.upsert') {
      const messages = payload.data.messages || [];
      logger.info('Webhook', `Processing ${messages.length} messages`, correlationId, {
        instanceName,
        ownerUserId,
        messageCount: messages.length
      });
      
      for (const [index, msg] of messages.entries()) {
        const messageCorrelationId = `${correlationId}-msg-${index}`;
        const key = msg.key || {};
        
        if (key.fromMe) {
          logger.debug('Webhook', `Ignoring own message: ${key.id}`, messageCorrelationId, {
            messageId: key.id,
            ownerUserId
          });
          continue;
        }

        const remoteJid = key.remoteJid || '';
        if (!remoteJid || remoteJid.endsWith('@g.us')) {
          logger.debug('Webhook', `Ignoring group message: ${remoteJid}`, messageCorrelationId, {
            remoteJid,
            ownerUserId
          });
          continue;
        }

        const phone = remoteJid.split('@')[0];
        
        // Extrair conteúdo da mensagem baseado no tipo
        let messageContent = '';
        let messageType = 'text';
        
        if (msg.message?.conversation) {
          messageContent = msg.message.conversation;
          messageType = 'text';
        } else if (msg.message?.extendedTextMessage?.text) {
          messageContent = msg.message.extendedTextMessage.text;
          messageType = 'text';
        } else if (msg.message?.imageMessage) {
          messageContent = msg.message.imageMessage.caption || 'Imagem';
          messageType = 'image';
        } else if (msg.message?.documentMessage) {
          messageContent = msg.message.documentMessage.fileName || 'Documento';
          messageType = 'file';
        } else if (msg.message?.audioMessage) {
          messageContent = 'Áudio';
          messageType = 'audio';
        } else if (msg.message?.videoMessage) {
          messageContent = msg.message.videoMessage.caption || 'Vídeo';
          messageType = 'video';
        } else {
          messageContent = 'Mensagem não suportada';
          messageType = 'text';
        }
        
        const pushName = msg.pushName || phone;

        if (!phone || !messageContent) {
          logger.warn('Webhook', 'Insufficient data to process message', messageCorrelationId, {
            phone,
            hasContent: !!messageContent,
            messageId: key.id,
            ownerUserId
          });
          continue;
        }

        logger.info('Webhook', `Processing message from ${pushName} (${phone})`, messageCorrelationId, {
          phone,
          pushName,
          messageType,
          contentLength: messageContent.length,
          messageId: key.id,
          ownerUserId
        });

        try {
          // Criar ou atualizar contato
          const { data: contact, error: contactError } = await supabaseAdmin
            .from('contacts')
            .upsert({ 
              user_id: ownerUserId, 
              phone_number: phone, 
              name: pushName 
            }, { 
              onConflict: 'user_id, phone_number' 
            })
            .select('id')
            .single();
          
          if (contactError) {
            logger.error('Webhook', `Failed to save contact ${phone}`, messageCorrelationId, {
              phone,
              pushName,
              ownerUserId,
              error: contactError.message
            });
            continue;
          }

          logger.debug('Webhook', `Contact saved/updated: ${phone}`, messageCorrelationId, {
            contactId: contact.id,
            phone,
            pushName
          });

          // Buscar conexão
          const { data: connection } = await supabaseAdmin
            .from('connections')
            .select('id')
            .eq('instance_name', instanceName)
            .eq('user_id', ownerUserId)
            .single();

          // Criar ou atualizar conversa (sempre como 'pending' para novas mensagens)
          const { data: conversation, error: convError } = await supabaseAdmin
            .from('conversations')
            .upsert({ 
              user_id: ownerUserId, 
              contact_id: contact.id, 
              status: 'pending',  // Sempre pendente para novas mensagens
              connection_id: connection?.id || null,
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'user_id, contact_id' 
            })
            .select('id')
            .single();
          
          if (convError) {
            logger.error('Webhook', `Failed to save conversation for ${phone}`, messageCorrelationId, {
              phone,
              contactId: contact.id,
              ownerUserId,
              error: convError.message
            });
            continue;
          }

          logger.debug('Webhook', `Conversation saved/updated: ${phone}`, messageCorrelationId, {
            conversationId: conversation.id,
            contactId: contact.id,
            status: 'pending'
          });

          // Inserir mensagem
          const { error: msgError } = await supabaseAdmin
            .from('messages')
            .insert({
              id: key.id,
              conversation_id: conversation.id,
              user_id: ownerUserId,
              sender_is_user: false,
              content: messageContent,
              message_type: messageType,
            });
          
          if (msgError && msgError.code !== '23505') { // Ignora erro de ID duplicado
            logger.error('Webhook', `Failed to insert message ${key.id}`, messageCorrelationId, {
              messageId: key.id,
              conversationId: conversation.id,
              ownerUserId,
              error: msgError.message
            });
            continue;
          } else if (msgError && msgError.code === '23505') {
            logger.debug('Webhook', `Duplicate message ignored: ${key.id}`, messageCorrelationId, {
              messageId: key.id,
              ownerUserId
            });
            continue;
          }

          logger.info('Webhook', `Message processed successfully: ${key.id}`, messageCorrelationId, {
            messageId: key.id,
            conversationId: conversation.id,
            contactId: contact.id,
            phone,
            messageType
          });

          // Notificar via WebSocket em tempo real
          const notifyResult = notifyUser(ownerUserId, 'new_message', {
            conversationId: conversation.id,
            contactId: contact.id,
            contactName: pushName,
            contactPhone: phone,
            messageId: key.id,
            content: messageContent,
            messageType: messageType,
            timestamp: new Date().toISOString()
          }, messageCorrelationId);

          if (notifyResult.success) {
            logger.info('Webhook', `WebSocket notification sent successfully to user ${ownerUserId}`, messageCorrelationId, {
              ownerUserId,
              messageId: key.id,
              notificationCorrelationId: notifyResult.correlationId
            });
          } else {
            logger.warn('Webhook', `Failed to send WebSocket notification to user ${ownerUserId}`, messageCorrelationId, {
              ownerUserId,
              messageId: key.id,
              error: notifyResult.error
            });
          }

        } catch (error) {
          logger.error('Webhook', `Fatal error processing message ${key.id}`, messageCorrelationId, {
            messageId: key.id,
            ownerUserId,
            phone,
            error: error.message,
            stack: error.stack
          });
        }
      }
    }

    logger.info('Webhook', 'Event processing completed successfully', correlationId, {
      eventType,
      instanceName,
      ownerUserId
    });

    res.status(200).json({ 
      ok: true,
      correlationId,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error('Webhook', 'Fatal error in webhook processing', correlationId, {
      error: errorMessage,
      stack: e instanceof Error ? e.stack : undefined,
      eventType: req.body?.event,
      instanceName: req.body?.instance
    });
    res.status(500).json({ 
      error: errorMessage,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para configurar webhook na Evolution API
app.post('/api/whatsapp/setup-webhook/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  const userId = req.headers['x-user-id'] || req.body.userId;
  const correlationId = req.correlationId || logger.generateCorrelationId();
  
  logger.info('Setup', `Starting webhook configuration for instance: ${instanceName}`, correlationId, {
    instanceName,
    userId
  });
  
  if (!userId) {
    logger.error('Setup', 'userId not provided', correlationId, { instanceName });
    return res.status(400).json({ 
      error: 'userId é obrigatório',
      correlationId 
    });
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    logger.error('Setup', 'Evolution API not configured', correlationId, {
      hasUrl: !!EVOLUTION_API_URL,
      hasKey: !!EVOLUTION_API_KEY,
      instanceName,
      userId
    });
    return res.status(500).json({ 
      error: 'Evolution API não configurada no servidor',
      correlationId 
    });
  }

  try {
    // Usar URL externa se disponível, senão usar a do request
    const baseUrl = process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/whatsapp/webhook?uid=${userId}`;
    
    const webhookConfig = {
      webhook: {
        url: webhookUrl,
        events: [
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED', 
          'MESSAGES_UPSERT'
        ]
      }
    };

    logger.info('Setup', `Configuring webhook for ${instanceName}`, correlationId, {
      instanceName,
      userId,
      webhookUrl,
      evolutionApiUrl: EVOLUTION_API_URL,
      events: webhookConfig.webhook.events
    });

    const targetUrl = `${EVOLUTION_API_URL}/webhook/set/${instanceName}`;
    logger.debug('Setup', `Making request to: ${targetUrl}`, correlationId, {
      targetUrl,
      method: 'POST'
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        'X-API-Key': EVOLUTION_API_KEY,
        'Authorization': `Bearer ${EVOLUTION_API_KEY}`,
      },
      body: JSON.stringify(webhookConfig)
    });

    logger.info('Setup', `Evolution API response: ${response.status} ${response.statusText}`, correlationId, {
      status: response.status,
      statusText: response.statusText,
      instanceName
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      logger.info('Setup', `Webhook configured successfully for ${instanceName}`, correlationId, {
        instanceName,
        userId,
        webhookUrl,
        responseData: data
      });
      res.json({ 
        success: true, 
        message: 'Webhook configurado com sucesso',
        webhookUrl,
        instanceName,
        data,
        correlationId
      });
    } else {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      logger.error('Setup', `Failed to configure webhook: ${response.status} ${response.statusText}`, correlationId, {
        status: response.status,
        statusText: response.statusText,
        errorText,
        instanceName,
        userId
      });
      res.status(response.status).json({ 
        error: `Erro ao configurar webhook: ${response.status} - ${response.statusText}`,
        details: errorText,
        instanceName,
        webhookUrl,
        correlationId
      });
    }
  } catch (error) {
    logger.error('Setup', 'Fatal error configuring webhook', correlationId, {
      error: error.message,
      stack: error.stack,
      instanceName,
      userId
    });
    res.status(500).json({ 
      error: error.message,
      instanceName,
      correlationId
    });
  }
});

// Proxy para Evolution API
app.all('/api/evolution/*', async (req, res) => {
  const correlationId = req.correlationId || logger.generateCorrelationId();
  logger.info('Proxy', `${req.method} ${req.path} -> Evolution API`, correlationId, {
    method: req.method,
    path: req.path,
    targetUrl: EVOLUTION_API_URL
  });

  if (!EVOLUTION_API_URL) {
    logger.error('Proxy', 'EVOLUTION_API_URL not configured', correlationId);
    return res.status(500).json({ 
      error: 'EVOLUTION_API_URL não configurado no backend.',
      correlationId 
    });
  }

  if (!EVOLUTION_API_KEY) {
    logger.error('Proxy', 'EVOLUTION_API_KEY not configured', correlationId);
    return res.status(500).json({ 
      error: 'EVOLUTION_API_KEY não configurado no backend.',
      correlationId 
    });
  }

  const path = req.path.replace('/api/evolution', '');
  const qsIndex = req.originalUrl.indexOf('?');
  const query = qsIndex >= 0 ? req.originalUrl.slice(qsIndex) : '';
  const targetUrl = `${EVOLUTION_API_URL}${path}${query}`;

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: EVOLUTION_API_KEY,
    'X-API-Key': EVOLUTION_API_KEY,
    Authorization: `Bearer ${EVOLUTION_API_KEY}`,
  };

  try {
    logger.debug('Proxy', `Forwarding to: ${targetUrl}`, correlationId, {
      targetUrl,
      method: req.method,
      hasBody: !!(req.body && Object.keys(req.body).length)
    });

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });

    const contentType = resp.headers.get('content-type') || '';
    const status = resp.status;

    logger.info('Proxy', `Evolution API response: ${status}`, correlationId, {
      status,
      contentType,
      targetUrl
    });

    if (contentType.includes('application/json')) {
      const json = await resp.json().catch(() => null);
      res.status(status).json(json ?? {});
    } else {
      const text = await resp.text().catch(() => '');
      res.status(status).send(text);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('Proxy', 'Failed to forward request to Evolution API', correlationId, {
      error: msg,
      targetUrl,
      method: req.method,
      stack: e instanceof Error ? e.stack : undefined
    });
    res.status(502).json({ 
      error: `Erro no proxy: ${msg}`,
      correlationId 
    });
  }
});

// Rota fallback para servir o index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (require('fs').existsSync(distPath)) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).send('Frontend não buildado. Execute `npm run build`.');
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const correlationId = req.correlationId || logger.generateCorrelationId();
  
  logger.error('ErrorHandler', 'Unhandled error', correlationId, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message,
    timestamp: new Date().toISOString(),
    correlationId
  });
});

server.listen(PORT, () => {
  const startupCorrelationId = logger.generateCorrelationId();
  
  logger.info('Server', `Backend WebSocket server started on http://localhost:${PORT}`, startupCorrelationId, {
    port: PORT,
    evolutionApiUrl: EVOLUTION_API_URL || 'NOT_CONFIGURED',
    evolutionApiKey: EVOLUTION_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
    supabase: SUPABASE_AVAILABLE ? 'AVAILABLE' : 'DISABLED',
    websocket: 'ENABLED',
    logLevel: logger.logLevel,
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  // Log startup configuration
  console.log(`\x1b[32m[OK]\x1b[0m Backend WebSocket server rodando em http://localhost:${PORT}`);
  console.log(`[Config] Evolution API URL: ${EVOLUTION_API_URL || 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Evolution API Key: ${EVOLUTION_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Supabase: ${SUPABASE_AVAILABLE ? 'Disponível' : 'Desabilitado'}`);
  console.log(`[Config] WebSocket: Habilitado`);
  console.log(`[Config] Log Level: ${logger.logLevel.toUpperCase()}`);
  console.log(`[Config] Startup Correlation ID: ${startupCorrelationId}`);
});