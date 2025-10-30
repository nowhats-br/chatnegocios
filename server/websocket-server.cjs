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

// Performance metrics and monitoring system
class MetricsCollector {
  constructor() {
    this.metrics = {
      // Connection metrics
      totalConnections: 0,
      currentConnections: 0,
      peakConnections: 0,
      connectionDuration: [], // Array of connection durations
      
      // Message metrics
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalBatchesSent: 0,
      messageLatency: [], // Array of message latencies
      
      // Error metrics
      connectionErrors: 0,
      messageErrors: 0,
      webhookErrors: 0,
      syncErrors: 0,
      
      // Performance metrics
      memoryUsage: [],
      cpuUsage: [],
      responseTime: [], // Array of response times
      
      // System metrics
      uptime: Date.now(),
      lastReset: new Date().toISOString(),
      
      // Throughput metrics
      messagesPerSecond: 0,
      connectionsPerMinute: 0,
      
      // Health metrics
      healthCheckCount: 0,
      healthCheckErrors: 0
    };
    
    // Circular buffer size for performance arrays
    this.maxArraySize = 1000;
    
    // Start periodic metrics collection
    this.startPeriodicCollection();
  }

  // Connection metrics
  recordConnection() {
    this.metrics.totalConnections++;
    this.metrics.currentConnections++;
    this.metrics.peakConnections = Math.max(this.metrics.peakConnections, this.metrics.currentConnections);
    
    logger.debug('Metrics', 'Connection recorded', null, {
      totalConnections: this.metrics.totalConnections,
      currentConnections: this.metrics.currentConnections,
      peakConnections: this.metrics.peakConnections
    });
  }

  recordDisconnection(connectionDuration) {
    this.metrics.currentConnections = Math.max(0, this.metrics.currentConnections - 1);
    
    if (connectionDuration > 0) {
      this.addToCircularArray(this.metrics.connectionDuration, connectionDuration);
    }
    
    logger.debug('Metrics', 'Disconnection recorded', null, {
      currentConnections: this.metrics.currentConnections,
      connectionDuration: `${Math.round(connectionDuration / 1000)}s`
    });
  }

  // Message metrics
  recordMessageSent(latency = null) {
    this.metrics.totalMessagesSent++;
    
    if (latency !== null && latency > 0) {
      this.addToCircularArray(this.metrics.messageLatency, latency);
    }
  }

  recordMessageReceived() {
    this.metrics.totalMessagesReceived++;
  }

  recordBatchSent() {
    this.metrics.totalBatchesSent++;
  }

  // Error metrics
  recordConnectionError() {
    this.metrics.connectionErrors++;
    logger.debug('Metrics', 'Connection error recorded', null, {
      totalConnectionErrors: this.metrics.connectionErrors
    });
  }

  recordMessageError() {
    this.metrics.messageErrors++;
    logger.debug('Metrics', 'Message error recorded', null, {
      totalMessageErrors: this.metrics.messageErrors
    });
  }

  recordWebhookError() {
    this.metrics.webhookErrors++;
    logger.debug('Metrics', 'Webhook error recorded', null, {
      totalWebhookErrors: this.metrics.webhookErrors
    });
  }

  recordSyncError() {
    this.metrics.syncErrors++;
    logger.debug('Metrics', 'Sync error recorded', null, {
      totalSyncErrors: this.metrics.syncErrors
    });
  }

  // Performance metrics
  recordResponseTime(responseTime) {
    this.addToCircularArray(this.metrics.responseTime, responseTime);
  }

  recordHealthCheck(success = true) {
    this.metrics.healthCheckCount++;
    if (!success) {
      this.metrics.healthCheckErrors++;
    }
  }

  // Utility method for circular arrays
  addToCircularArray(array, value) {
    array.push(value);
    if (array.length > this.maxArraySize) {
      array.shift();
    }
  }

  // Calculate statistics for arrays
  calculateStats(array) {
    if (array.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }
    
    const min = Math.min(...array);
    const max = Math.max(...array);
    const avg = array.reduce((sum, val) => sum + val, 0) / array.length;
    
    return { min, max, avg, count: array.length };
  }

  // Periodic metrics collection
  startPeriodicCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
      this.calculateThroughput();
    }, 30000);
    
    logger.info('Metrics', 'Periodic metrics collection started', null, {
      interval: '30s',
      maxArraySize: this.maxArraySize
    });
  }

  collectSystemMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.addToCircularArray(this.metrics.memoryUsage, {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        timestamp: Date.now()
      });
      
      // CPU usage (simplified - would need more complex calculation for accurate CPU usage)
      const cpuUsage = process.cpuUsage();
      this.addToCircularArray(this.metrics.cpuUsage, {
        user: cpuUsage.user,
        system: cpuUsage.system,
        timestamp: Date.now()
      });
      
      logger.debug('Metrics', 'System metrics collected', null, {
        memoryRSS: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        memoryHeap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        cpuUser: cpuUsage.user,
        cpuSystem: cpuUsage.system
      });
    } catch (error) {
      logger.error('Metrics', 'Error collecting system metrics', null, {
        error: error.message
      });
    }
  }

  calculateThroughput() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000; // 1 minute ago
    const oneSecondAgo = now - 1000; // 1 second ago
    
    // Calculate messages per second (simplified - would need time-based tracking for accuracy)
    this.metrics.messagesPerSecond = this.metrics.totalMessagesSent > 0 ? 
      Math.round(this.metrics.totalMessagesSent / ((now - this.metrics.uptime) / 1000)) : 0;
    
    // Calculate connections per minute (simplified)
    this.metrics.connectionsPerMinute = this.metrics.totalConnections > 0 ?
      Math.round(this.metrics.totalConnections / ((now - this.metrics.uptime) / 60000)) : 0;
  }

  // Get comprehensive metrics report
  getMetrics() {
    const now = Date.now();
    const uptimeSeconds = Math.round((now - this.metrics.uptime) / 1000);
    
    return {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptimeSeconds,
        formatted: this.formatUptime(uptimeSeconds)
      },
      connections: {
        total: this.metrics.totalConnections,
        current: this.metrics.currentConnections,
        peak: this.metrics.peakConnections,
        duration: this.calculateStats(this.metrics.connectionDuration)
      },
      messages: {
        sent: this.metrics.totalMessagesSent,
        received: this.metrics.totalMessagesReceived,
        batches: this.metrics.totalBatchesSent,
        latency: this.calculateStats(this.metrics.messageLatency),
        throughput: {
          messagesPerSecond: this.metrics.messagesPerSecond,
          connectionsPerMinute: this.metrics.connectionsPerMinute
        }
      },
      errors: {
        connections: this.metrics.connectionErrors,
        messages: this.metrics.messageErrors,
        webhooks: this.metrics.webhookErrors,
        syncs: this.metrics.syncErrors,
        total: this.metrics.connectionErrors + this.metrics.messageErrors + 
               this.metrics.webhookErrors + this.metrics.syncErrors
      },
      performance: {
        responseTime: this.calculateStats(this.metrics.responseTime),
        memory: this.getLatestMemoryUsage(),
        cpu: this.getLatestCpuUsage()
      },
      health: {
        checks: this.metrics.healthCheckCount,
        errors: this.metrics.healthCheckErrors,
        successRate: this.metrics.healthCheckCount > 0 ? 
          Math.round(((this.metrics.healthCheckCount - this.metrics.healthCheckErrors) / this.metrics.healthCheckCount) * 100) : 100
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      }
    };
  }

  getLatestMemoryUsage() {
    if (this.metrics.memoryUsage.length === 0) return null;
    
    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    return {
      rss: `${Math.round(latest.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(latest.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(latest.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(latest.external / 1024 / 1024)}MB`
    };
  }

  getLatestCpuUsage() {
    if (this.metrics.cpuUsage.length === 0) return null;
    
    const latest = this.metrics.cpuUsage[this.metrics.cpuUsage.length - 1];
    return {
      user: latest.user,
      system: latest.system
    };
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Reset metrics
  reset() {
    const oldMetrics = { ...this.metrics };
    
    this.metrics = {
      totalConnections: 0,
      currentConnections: this.metrics.currentConnections, // Keep current connections
      peakConnections: 0,
      connectionDuration: [],
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalBatchesSent: 0,
      messageLatency: [],
      connectionErrors: 0,
      messageErrors: 0,
      webhookErrors: 0,
      syncErrors: 0,
      memoryUsage: [],
      cpuUsage: [],
      responseTime: [],
      uptime: Date.now(),
      lastReset: new Date().toISOString(),
      messagesPerSecond: 0,
      connectionsPerMinute: 0,
      healthCheckCount: 0,
      healthCheckErrors: 0
    };
    
    logger.info('Metrics', 'Metrics reset completed', null, {
      previousUptime: this.formatUptime(Math.round((Date.now() - oldMetrics.uptime) / 1000)),
      previousTotalConnections: oldMetrics.totalConnections,
      previousTotalMessages: oldMetrics.totalMessagesSent
    });
  }

  // Export metrics for external monitoring systems
  exportPrometheusMetrics() {
    const metrics = this.getMetrics();
    
    // Simple Prometheus-style metrics format
    const prometheusMetrics = [
      `# HELP websocket_connections_total Total number of WebSocket connections`,
      `# TYPE websocket_connections_total counter`,
      `websocket_connections_total ${metrics.connections.total}`,
      ``,
      `# HELP websocket_connections_current Current number of active WebSocket connections`,
      `# TYPE websocket_connections_current gauge`,
      `websocket_connections_current ${metrics.connections.current}`,
      ``,
      `# HELP websocket_messages_sent_total Total number of messages sent`,
      `# TYPE websocket_messages_sent_total counter`,
      `websocket_messages_sent_total ${metrics.messages.sent}`,
      ``,
      `# HELP websocket_messages_received_total Total number of messages received`,
      `# TYPE websocket_messages_received_total counter`,
      `websocket_messages_received_total ${metrics.messages.received}`,
      ``,
      `# HELP websocket_errors_total Total number of errors by type`,
      `# TYPE websocket_errors_total counter`,
      `websocket_errors_total{type="connection"} ${metrics.errors.connections}`,
      `websocket_errors_total{type="message"} ${metrics.errors.messages}`,
      `websocket_errors_total{type="webhook"} ${metrics.errors.webhooks}`,
      `websocket_errors_total{type="sync"} ${metrics.errors.syncs}`,
      ``,
      `# HELP websocket_uptime_seconds Server uptime in seconds`,
      `# TYPE websocket_uptime_seconds gauge`,
      `websocket_uptime_seconds ${metrics.uptime.seconds}`,
      ``
    ].join('\n');
    
    return prometheusMetrics;
  }
}

const metricsCollector = new MetricsCollector();

// Message acknowledgment system
class MessageAckManager {
  constructor() {
    this.pendingMessages = new Map(); // messageId -> { userId, timestamp, retryCount, timeout }
    this.ackTimeout = 30000; // 30 seconds timeout
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds between retries
  }

  addPendingMessage(messageId, userId, correlationId, originalEvent = null, originalData = null) {
    const timeout = setTimeout(() => {
      this.handleTimeout(messageId);
    }, this.ackTimeout);

    this.pendingMessages.set(messageId, {
      userId,
      correlationId,
      timestamp: Date.now(),
      retryCount: 0,
      timeout,
      originalEvent,
      originalData
    });

    logger.debug('MessageAck', `Message added to pending acknowledgments: ${messageId}`, correlationId, {
      messageId,
      userId,
      hasOriginalData: !!(originalEvent && originalData),
      totalPending: this.pendingMessages.size
    });
  }

  acknowledgeMessage(messageId, correlationId) {
    const pending = this.pendingMessages.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(messageId);
      
      const deliveryTime = Date.now() - pending.timestamp;
      logger.info('MessageAck', `Message acknowledged: ${messageId}`, correlationId, {
        messageId,
        userId: pending.userId,
        deliveryTime: `${deliveryTime}ms`,
        remainingPending: this.pendingMessages.size
      });
      
      connectionTracker.messageStats.acknowledged++;
      return true;
    }
    
    logger.warn('MessageAck', `Acknowledgment received for unknown message: ${messageId}`, correlationId, {
      messageId
    });
    return false;
  }

  handleTimeout(messageId) {
    const pending = this.pendingMessages.get(messageId);
    if (!pending) return;

    logger.warn('MessageAck', `Message acknowledgment timeout: ${messageId}`, pending.correlationId, {
      messageId,
      userId: pending.userId,
      retryCount: pending.retryCount,
      timeoutDuration: `${this.ackTimeout}ms`
    });

    if (pending.retryCount < this.maxRetries) {
      // Retry message delivery
      this.retryMessage(messageId, pending);
    } else {
      // Give up after max retries
      logger.error('MessageAck', `Message delivery failed after max retries: ${messageId}`, pending.correlationId, {
        messageId,
        userId: pending.userId,
        maxRetries: this.maxRetries
      });
      
      this.pendingMessages.delete(messageId);
      connectionTracker.messageStats.failed++;
    }
  }

  retryMessage(messageId, pending) {
    pending.retryCount++;
    
    setTimeout(() => {
      const socketId = connectedUsers.get(pending.userId);
      if (socketId && this.pendingMessages.has(messageId)) {
        logger.info('MessageAck', `Retrying message delivery: ${messageId}`, pending.correlationId, {
          messageId,
          userId: pending.userId,
          retryCount: pending.retryCount,
          maxRetries: this.maxRetries
        });

        // Reset timeout for retry
        clearTimeout(pending.timeout);
        pending.timeout = setTimeout(() => {
          this.handleTimeout(messageId);
        }, this.ackTimeout);
        
        // Re-emit the message if we have the original data stored
        if (pending.originalEvent && pending.originalData) {
          try {
            io.to(socketId).emit(pending.originalEvent, {
              ...pending.originalData,
              retryCount: pending.retryCount,
              isRetry: true
            });
            
            logger.debug('MessageAck', `Message retry sent: ${messageId}`, pending.correlationId, {
              messageId,
              event: pending.originalEvent,
              retryCount: pending.retryCount
            });
          } catch (error) {
            logger.error('MessageAck', `Failed to retry message: ${messageId}`, pending.correlationId, {
              messageId,
              error: error.message
            });
          }
        } else {
          logger.warn('MessageAck', `Cannot retry message, original data not available: ${messageId}`, pending.correlationId);
        }
      } else {
        logger.warn('MessageAck', `Cannot retry message, user disconnected: ${messageId}`, pending.correlationId, {
          messageId,
          userId: pending.userId
        });
        this.pendingMessages.delete(messageId);
      }
    }, this.retryDelay);
  }

  getPendingStats() {
    return {
      totalPending: this.pendingMessages.size,
      pendingMessages: Array.from(this.pendingMessages.entries()).map(([messageId, data]) => ({
        messageId,
        userId: data.userId,
        retryCount: data.retryCount,
        pendingTime: Date.now() - data.timestamp
      }))
    };
  }

  cleanup() {
    // Clear all timeouts and pending messages
    for (const [messageId, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
    }
    this.pendingMessages.clear();
    logger.info('MessageAck', 'Message acknowledgment manager cleaned up');
  }
}

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

// Heartbeat system for connection monitoring
class HeartbeatManager {
  constructor() {
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimeout = 60000; // 60 seconds timeout
    this.clientHeartbeats = new Map(); // userId -> { lastHeartbeat, timeoutId, missedCount }
    this.serverHeartbeatInterval = null;
    this.maxMissedHeartbeats = 3;
  }

  startServerHeartbeat() {
    if (this.serverHeartbeatInterval) {
      clearInterval(this.serverHeartbeatInterval);
    }

    this.serverHeartbeatInterval = setInterval(() => {
      this.sendHeartbeatToAllClients();
      this.checkStaleConnections();
    }, this.heartbeatInterval);

    logger.info('Heartbeat', 'Server heartbeat system started', null, {
      interval: this.heartbeatInterval,
      timeout: this.heartbeatTimeout,
      maxMissedHeartbeats: this.maxMissedHeartbeats
    });
  }

  stopServerHeartbeat() {
    if (this.serverHeartbeatInterval) {
      clearInterval(this.serverHeartbeatInterval);
      this.serverHeartbeatInterval = null;
    }

    // Clear all client timeouts
    for (const [userId, heartbeatData] of this.clientHeartbeats) {
      if (heartbeatData.timeoutId) {
        clearTimeout(heartbeatData.timeoutId);
      }
    }
    this.clientHeartbeats.clear();

    logger.info('Heartbeat', 'Server heartbeat system stopped');
  }

  sendHeartbeatToAllClients() {
    const connectedCount = connectedUsers.size;
    if (connectedCount === 0) {
      logger.debug('Heartbeat', 'No clients connected, skipping heartbeat broadcast');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const [userId, socketId] of connectedUsers) {
      try {
        io.to(socketId).emit('server_heartbeat', {
          timestamp: new Date().toISOString(),
          serverId: process.pid
        });
        successCount++;
        
        logger.debug('Heartbeat', `Heartbeat sent to user: ${userId}`, null, {
          userId,
          socketId
        });
      } catch (error) {
        failureCount++;
        logger.error('Heartbeat', `Failed to send heartbeat to user: ${userId}`, null, {
          userId,
          socketId,
          error: error.message
        });
      }
    }

    logger.debug('Heartbeat', 'Heartbeat broadcast completed', null, {
      totalClients: connectedCount,
      successCount,
      failureCount
    });
  }

  registerClient(userId, socketId) {
    const now = Date.now();
    
    // Clear existing timeout if any
    const existing = this.clientHeartbeats.get(userId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    this.clientHeartbeats.set(userId, {
      lastHeartbeat: now,
      timeoutId: null,
      missedCount: 0,
      socketId
    });

    logger.debug('Heartbeat', `Client registered for heartbeat monitoring: ${userId}`, null, {
      userId,
      socketId,
      totalClients: this.clientHeartbeats.size
    });
  }

  updateClientHeartbeat(userId) {
    const heartbeatData = this.clientHeartbeats.get(userId);
    if (heartbeatData) {
      const now = Date.now();
      const latency = now - heartbeatData.lastHeartbeat;
      
      heartbeatData.lastHeartbeat = now;
      heartbeatData.missedCount = 0;
      
      // Clear existing timeout
      if (heartbeatData.timeoutId) {
        clearTimeout(heartbeatData.timeoutId);
      }

      // Set new timeout for this client
      heartbeatData.timeoutId = setTimeout(() => {
        this.handleMissedHeartbeat(userId);
      }, this.heartbeatTimeout);

      logger.debug('Heartbeat', `Client heartbeat updated: ${userId}`, null, {
        userId,
        latency: `${latency}ms`,
        lastHeartbeat: new Date(now).toISOString()
      });

      // Update connection tracker activity
      connectionTracker.updateActivity(userId);
      
      return latency;
    } else {
      logger.warn('Heartbeat', `Heartbeat received from unregistered client: ${userId}`, null, {
        userId
      });
      return null;
    }
  }

  handleMissedHeartbeat(userId) {
    const heartbeatData = this.clientHeartbeats.get(userId);
    if (!heartbeatData) return;

    heartbeatData.missedCount++;
    const timeSinceLastHeartbeat = Date.now() - heartbeatData.lastHeartbeat;

    logger.warn('Heartbeat', `Missed heartbeat from client: ${userId}`, null, {
      userId,
      missedCount: heartbeatData.missedCount,
      maxMissedHeartbeats: this.maxMissedHeartbeats,
      timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`
    });

    if (heartbeatData.missedCount >= this.maxMissedHeartbeats) {
      logger.error('Heartbeat', `Client exceeded max missed heartbeats, disconnecting: ${userId}`, null, {
        userId,
        missedCount: heartbeatData.missedCount,
        maxMissedHeartbeats: this.maxMissedHeartbeats,
        timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`
      });

      this.disconnectStaleClient(userId);
    } else {
      // Schedule next timeout check
      heartbeatData.timeoutId = setTimeout(() => {
        this.handleMissedHeartbeat(userId);
      }, this.heartbeatTimeout);
    }
  }

  disconnectStaleClient(userId) {
    const socketId = connectedUsers.get(userId);
    const heartbeatData = this.clientHeartbeats.get(userId);
    
    if (socketId) {
      try {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          logger.info('Heartbeat', `Stale client disconnected: ${userId}`, null, {
            userId,
            socketId,
            reason: 'heartbeat_timeout'
          });
        }
      } catch (error) {
        logger.error('Heartbeat', `Error disconnecting stale client: ${userId}`, null, {
          userId,
          socketId,
          error: error.message
        });
      }
    }

    // Clean up heartbeat data
    if (heartbeatData?.timeoutId) {
      clearTimeout(heartbeatData.timeoutId);
    }
    this.clientHeartbeats.delete(userId);
    connectedUsers.delete(userId);
    connectionTracker.removeConnection(userId);
  }

  checkStaleConnections() {
    const now = Date.now();
    const staleThreshold = this.heartbeatTimeout * 2; // Double the timeout as final threshold
    
    for (const [userId, heartbeatData] of this.clientHeartbeats) {
      const timeSinceLastHeartbeat = now - heartbeatData.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > staleThreshold) {
        logger.warn('Heartbeat', `Detected stale connection during check: ${userId}`, null, {
          userId,
          timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`,
          staleThreshold: `${Math.round(staleThreshold / 1000)}s`
        });
        
        this.disconnectStaleClient(userId);
      }
    }
  }

  unregisterClient(userId) {
    const heartbeatData = this.clientHeartbeats.get(userId);
    if (heartbeatData) {
      if (heartbeatData.timeoutId) {
        clearTimeout(heartbeatData.timeoutId);
      }
      this.clientHeartbeats.delete(userId);
      
      logger.debug('Heartbeat', `Client unregistered from heartbeat monitoring: ${userId}`, null, {
        userId,
        remainingClients: this.clientHeartbeats.size
      });
    }
  }

  getHeartbeatStats() {
    const now = Date.now();
    const stats = {
      totalClients: this.clientHeartbeats.size,
      activeClients: 0,
      staleClients: 0,
      clients: []
    };

    for (const [userId, heartbeatData] of this.clientHeartbeats) {
      const timeSinceLastHeartbeat = now - heartbeatData.lastHeartbeat;
      const isStale = timeSinceLastHeartbeat > this.heartbeatTimeout;
      
      if (isStale) {
        stats.staleClients++;
      } else {
        stats.activeClients++;
      }

      stats.clients.push({
        userId,
        lastHeartbeat: new Date(heartbeatData.lastHeartbeat).toISOString(),
        timeSinceLastHeartbeat: `${Math.round(timeSinceLastHeartbeat / 1000)}s`,
        missedCount: heartbeatData.missedCount,
        isStale
      });
    }

    return stats;
  }
}

// Enhanced message batching system for performance optimization
class MessageBatcher {
  constructor() {
    this.batches = new Map(); // userId -> { messages: [], timeout: timeoutId }
    this.batchSize = 10; // Maximum messages per batch
    this.batchTimeout = 100; // 100ms timeout for batching
    this.stats = {
      totalBatches: 0,
      totalMessages: 0,
      averageBatchSize: 0
    };
  }

  addMessage(userId, event, data, correlationId) {
    if (!this.batches.has(userId)) {
      this.batches.set(userId, {
        messages: [],
        timeout: null
      });
    }

    const batch = this.batches.get(userId);
    batch.messages.push({
      event,
      data: {
        ...data,
        correlationId,
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      timestamp: Date.now()
    });

    // Clear existing timeout
    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }

    // Send immediately if batch is full, otherwise set timeout
    if (batch.messages.length >= this.batchSize) {
      this.flushBatch(userId);
    } else {
      batch.timeout = setTimeout(() => {
        this.flushBatch(userId);
      }, this.batchTimeout);
    }

    logger.debug('MessageBatcher', `Message added to batch for user: ${userId}`, correlationId, {
      userId,
      batchSize: batch.messages.length,
      maxBatchSize: this.batchSize,
      event
    });
  }

  flushBatch(userId) {
    const batch = this.batches.get(userId);
    if (!batch || batch.messages.length === 0) return;

    const socketId = connectedUsers.get(userId);
    if (!socketId) {
      // User offline, move to message queue
      for (const message of batch.messages) {
        messageQueue.queueMessage(userId, message.event, message.data, message.data.correlationId);
      }
      logger.info('MessageBatcher', `Batch moved to queue for offline user: ${userId}`, null, {
        userId,
        batchSize: batch.messages.length
      });
    } else {
      try {
        // Send batched messages
        io.to(socketId).emit('message_batch', {
          messages: batch.messages,
          batchId: `batch_${Date.now()}_${userId}`,
          timestamp: new Date().toISOString(),
          totalMessages: batch.messages.length
        });

        // Update statistics
        this.stats.totalBatches++;
        this.stats.totalMessages += batch.messages.length;
        this.stats.averageBatchSize = this.stats.totalMessages / this.stats.totalBatches;

        connectionTracker.incrementMessagesSent(userId);
        connectionTracker.messageStats.delivered += batch.messages.length;

        logger.info('MessageBatcher', `Batch sent to user: ${userId}`, null, {
          userId,
          socketId,
          batchSize: batch.messages.length,
          batchId: `batch_${Date.now()}_${userId}`
        });
      } catch (error) {
        logger.error('MessageBatcher', `Failed to send batch to user: ${userId}`, null, {
          userId,
          socketId,
          batchSize: batch.messages.length,
          error: error.message
        });

        // Move failed batch to queue
        for (const message of batch.messages) {
          messageQueue.queueMessage(userId, message.event, message.data, message.data.correlationId);
        }
      }
    }

    // Clear timeout and reset batch
    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }
    this.batches.delete(userId);
  }

  flushAllBatches() {
    for (const userId of this.batches.keys()) {
      this.flushBatch(userId);
    }
  }

  getBatchStats() {
    return {
      ...this.stats,
      activeBatches: this.batches.size,
      batchDetails: Array.from(this.batches.entries()).map(([userId, batch]) => ({
        userId,
        messageCount: batch.messages.length,
        oldestMessage: batch.messages.length > 0 ? 
          `${Math.round((Date.now() - batch.messages[0].timestamp) / 1000)}s ago` : null
      }))
    };
  }

  cleanup() {
    // Flush all pending batches
    this.flushAllBatches();
    
    // Clear all timeouts
    for (const [userId, batch] of this.batches) {
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
    }
    this.batches.clear();
    
    logger.info('MessageBatcher', 'Message batcher cleaned up', null, {
      totalBatchesSent: this.stats.totalBatches,
      totalMessagesSent: this.stats.totalMessages,
      averageBatchSize: this.stats.averageBatchSize
    });
  }
}

// Enhanced message queue system for offline users
class MessageQueue {
  constructor() {
    this.queues = new Map(); // userId -> messages[]
    this.maxQueueSize = 100;
    this.retryInterval = 5000;
    this.messageExpirationTime = 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = 60 * 60 * 1000; // 1 hour cleanup interval
    this.cleanupTimer = null;
    
    // Start periodic cleanup
    this.startCleanup();
  }

  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, this.cleanupInterval);
    
    logger.info('MessageQueue', 'Cleanup timer started', null, {
      cleanupInterval: this.cleanupInterval,
      messageExpirationTime: this.messageExpirationTime
    });
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('MessageQueue', 'Cleanup timer stopped');
    }
  }

  queueMessage(userId, event, data, correlationId = null) {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }
    
    const queue = this.queues.get(userId);
    const now = Date.now();
    
    // Remove oldest messages if queue is full
    while (queue.length >= this.maxQueueSize) {
      const removed = queue.shift();
      logger.warn('MessageQueue', `Queue full, removing oldest message for user: ${userId}`, correlationId, {
        userId,
        removedMessageId: removed?.messageId,
        queueSize: queue.length,
        maxQueueSize: this.maxQueueSize
      });
    }
    
    const queuedMessage = {
      messageId: data.messageId || `queued_${now}_${Math.random().toString(36).substr(2, 9)}`,
      event,
      data: {
        ...data,
        correlationId: correlationId || logger.generateCorrelationId(),
        queuedAt: new Date().toISOString(),
        isQueued: true
      },
      queuedAt: now,
      retryCount: 0,
      correlationId
    };
    
    queue.push(queuedMessage);
    
    logger.info('MessageQueue', `Message queued for offline user: ${userId}`, correlationId, {
      userId,
      event,
      messageId: queuedMessage.messageId,
      queueSize: queue.length,
      maxQueueSize: this.maxQueueSize
    });
    
    return queuedMessage.messageId;
  }

  processQueue(userId) {
    const queue = this.queues.get(userId);
    if (!queue || queue.length === 0) {
      logger.debug('MessageQueue', `No queued messages for user: ${userId}`, null, {
        userId,
        hasQueue: !!queue,
        queueSize: queue ? queue.length : 0
      });
      return { processed: 0, failed: 0 };
    }

    logger.info('MessageQueue', `Processing ${queue.length} queued messages for user: ${userId}`, null, {
      userId,
      queueSize: queue.length
    });

    let processed = 0;
    let failed = 0;
    const now = Date.now();
    
    // Process messages in order
    const messagesToProcess = [...queue]; // Create copy to avoid modification during iteration
    this.queues.delete(userId); // Clear the queue
    
    for (const queuedMessage of messagesToProcess) {
      try {
        // Check if message has expired
        if (now - queuedMessage.queuedAt > this.messageExpirationTime) {
          logger.warn('MessageQueue', `Expired queued message skipped: ${queuedMessage.messageId}`, queuedMessage.correlationId, {
            userId,
            messageId: queuedMessage.messageId,
            age: `${Math.round((now - queuedMessage.queuedAt) / 1000)}s`,
            expirationTime: `${Math.round(this.messageExpirationTime / 1000)}s`
          });
          failed++;
          continue;
        }

        // Deliver the queued message
        const result = notifyUser(userId, queuedMessage.event, queuedMessage.data, queuedMessage.correlationId, false);
        
        if (result.success) {
          processed++;
          logger.debug('MessageQueue', `Queued message delivered: ${queuedMessage.messageId}`, queuedMessage.correlationId, {
            userId,
            messageId: queuedMessage.messageId,
            event: queuedMessage.event
          });
        } else {
          failed++;
          logger.error('MessageQueue', `Failed to deliver queued message: ${queuedMessage.messageId}`, queuedMessage.correlationId, {
            userId,
            messageId: queuedMessage.messageId,
            error: result.error
          });
        }
      } catch (error) {
        failed++;
        logger.error('MessageQueue', `Error processing queued message: ${queuedMessage.messageId}`, queuedMessage.correlationId, {
          userId,
          messageId: queuedMessage.messageId,
          error: error.message
        });
      }
    }

    logger.info('MessageQueue', `Queue processing completed for user: ${userId}`, null, {
      userId,
      totalMessages: messagesToProcess.length,
      processed,
      failed,
      successRate: `${Math.round((processed / messagesToProcess.length) * 100)}%`
    });

    return { processed, failed };
  }

  cleanupExpiredMessages() {
    const now = Date.now();
    let totalCleaned = 0;
    let totalQueues = 0;
    
    for (const [userId, queue] of this.queues) {
      totalQueues++;
      const originalSize = queue.length;
      
      // Filter out expired messages
      const validMessages = queue.filter(message => {
        const isExpired = now - message.queuedAt > this.messageExpirationTime;
        if (isExpired) {
          totalCleaned++;
          logger.debug('MessageQueue', `Expired message cleaned up: ${message.messageId}`, message.correlationId, {
            userId,
            messageId: message.messageId,
            age: `${Math.round((now - message.queuedAt) / 1000)}s`
          });
        }
        return !isExpired;
      });
      
      // Update queue if messages were removed
      if (validMessages.length !== originalSize) {
        if (validMessages.length === 0) {
          this.queues.delete(userId);
        } else {
          this.queues.set(userId, validMessages);
        }
      }
    }
    
    if (totalCleaned > 0) {
      logger.info('MessageQueue', 'Expired messages cleanup completed', null, {
        totalQueues,
        messagesRemoved: totalCleaned,
        remainingQueues: this.queues.size
      });
    }
  }

  getQueueStats() {
    const stats = {
      totalQueues: this.queues.size,
      totalMessages: 0,
      queueSizes: {},
      oldestMessage: null,
      newestMessage: null
    };
    
    let oldestTime = Infinity;
    let newestTime = 0;
    
    for (const [userId, queue] of this.queues) {
      stats.totalMessages += queue.length;
      stats.queueSizes[userId] = queue.length;
      
      for (const message of queue) {
        if (message.queuedAt < oldestTime) {
          oldestTime = message.queuedAt;
          stats.oldestMessage = {
            userId,
            messageId: message.messageId,
            age: `${Math.round((Date.now() - message.queuedAt) / 1000)}s`
          };
        }
        if (message.queuedAt > newestTime) {
          newestTime = message.queuedAt;
          stats.newestMessage = {
            userId,
            messageId: message.messageId,
            age: `${Math.round((Date.now() - message.queuedAt) / 1000)}s`
          };
        }
      }
    }
    
    return stats;
  }

  clearUserQueue(userId) {
    const queue = this.queues.get(userId);
    if (queue) {
      const clearedCount = queue.length;
      this.queues.delete(userId);
      
      logger.info('MessageQueue', `User queue cleared: ${userId}`, null, {
        userId,
        clearedMessages: clearedCount
      });
      
      return clearedCount;
    }
    return 0;
  }

  cleanup() {
    this.stopCleanup();
    const totalMessages = Array.from(this.queues.values()).reduce((sum, queue) => sum + queue.length, 0);
    this.queues.clear();
    
    logger.info('MessageQueue', 'Message queue system cleaned up', null, {
      clearedQueues: this.queues.size,
      clearedMessages: totalMessages
    });
  }
}

const connectionTracker = new ConnectionTracker();
const messageAckManager = new MessageAckManager();
const heartbeatManager = new HeartbeatManager();
const messageBatcher = new MessageBatcher();
const messageQueue = new MessageQueue();

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
        
        // Unregister old connection from heartbeat
        heartbeatManager.unregisterClient(userId);
      }

      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      
      // Track connection details
      connectionTracker.addConnection(userId, socket.id, socket);
      
      // Record connection metrics
      metricsCollector.recordConnection();
      
      // Register client for heartbeat monitoring
      heartbeatManager.registerClient(userId, socket.id);
      
      logger.info('WebSocket', `User registered successfully: ${userId}`, registerCorrelationId, {
        userId,
        socketId: socket.id,
        totalConnections: connectedUsers.size
      });
      
      // Process any queued messages for this user
      const queueResult = messageQueue.processQueue(userId);
      
      // Confirmar registro
      socket.emit('registered', { 
        userId, 
        socketId: socket.id,
        correlationId: registerCorrelationId,
        timestamp: new Date().toISOString(),
        heartbeatInterval: heartbeatManager.heartbeatInterval,
        queuedMessages: queueResult
      });
      
      // Notify about queued messages if any were processed
      if (queueResult.processed > 0) {
        logger.info('WebSocket', `Processed queued messages for user: ${userId}`, registerCorrelationId, {
          userId,
          processed: queueResult.processed,
          failed: queueResult.failed
        });
      }
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

  // Handle client heartbeat (client -> server)
  socket.on('heartbeat', () => {
    if (socket.userId) {
      const latency = heartbeatManager.updateClientHeartbeat(socket.userId);
      connectionTracker.incrementMessagesReceived(socket.userId);
      
      socket.emit('heartbeat_ack', { 
        timestamp: new Date().toISOString(),
        latency: latency ? `${latency}ms` : null
      });
      
      logger.debug('WebSocket', `Client heartbeat received from user: ${socket.userId}`, null, {
        userId: socket.userId,
        socketId: socket.id,
        latency: latency ? `${latency}ms` : 'unknown'
      });
    } else {
      logger.warn('WebSocket', 'Heartbeat received from unregistered socket', null, {
        socketId: socket.id
      });
    }
  });

  // Handle server heartbeat response (server -> client -> server)
  socket.on('server_heartbeat_response', (data) => {
    if (socket.userId) {
      const latency = heartbeatManager.updateClientHeartbeat(socket.userId);
      connectionTracker.incrementMessagesReceived(socket.userId);
      
      logger.debug('WebSocket', `Server heartbeat response from user: ${socket.userId}`, null, {
        userId: socket.userId,
        socketId: socket.id,
        clientTimestamp: data.clientTimestamp,
        latency: latency ? `${latency}ms` : 'unknown'
      });
    } else {
      logger.warn('WebSocket', 'Server heartbeat response from unregistered socket', null, {
        socketId: socket.id
      });
    }
  });

  // Handle message acknowledgment
  socket.on('message_ack', (data) => {
    if (socket.userId && data.messageId) {
      const success = messageAckManager.acknowledgeMessage(data.messageId, data.correlationId);
      if (success) {
        logger.debug('WebSocket', `Message acknowledged: ${data.messageId}`, data.correlationId, {
          userId: socket.userId,
          messageId: data.messageId
        });
      }
    } else {
      logger.warn('WebSocket', 'Invalid message acknowledgment received', null, {
        userId: socket.userId,
        messageId: data?.messageId,
        hasUserId: !!socket.userId,
        hasMessageId: !!data?.messageId
      });
    }
  });

  // Handle sync requests from clients
  socket.on('sync_request', async (data) => {
    const syncCorrelationId = data.correlationId || logger.generateCorrelationId();
    
    if (!socket.userId) {
      logger.warn('WebSocket', 'Sync request from unregistered socket', syncCorrelationId, {
        socketId: socket.id
      });
      return;
    }

    logger.info('WebSocket', `Sync request received from user: ${socket.userId}`, syncCorrelationId, {
      userId: socket.userId,
      lastSyncTimestamp: data.lastSyncTimestamp,
      socketId: socket.id
    });

    try {
      // Use the same sync logic as the REST endpoint
      if (!supabaseAdmin) {
        logger.error('WebSocket', 'Supabase not available for sync', syncCorrelationId);
        socket.emit('sync_response', {
          success: false,
          error: 'Banco de dados não disponível',
          correlationId: syncCorrelationId,
          requiresAck: true,
          messageId: `sync_error_${Date.now()}`
        });
        return;
      }

      // Optimized query for conversations with selective field loading
      let conversationQuery = supabaseAdmin
        .from('conversations')
        .select(`
          id,
          user_id,
          contact_id,
          status,
          created_at,
          updated_at,
          contacts!inner (
            id,
            name,
            phone_number,
            avatar_url
          )
        `)
        .eq('user_id', socket.userId)
        .order('updated_at', { ascending: false });

      // Apply timestamp filter if provided for better performance
      if (data.lastSyncTimestamp) {
        conversationQuery = conversationQuery.gt('updated_at', data.lastSyncTimestamp);
        logger.debug('WebSocket', `Filtering conversations updated after: ${data.lastSyncTimestamp}`, syncCorrelationId);
      }

      // Apply limit
      conversationQuery = conversationQuery.limit(50);

      const { data: conversations, error } = await conversationQuery;
      
      if (error) {
        logger.error('WebSocket', 'Failed to fetch conversations for sync', syncCorrelationId, {
          userId: socket.userId,
          error: error.message
        });
        
        socket.emit('sync_response', {
          success: false,
          error: 'Erro ao buscar conversas',
          details: error.message,
          correlationId: syncCorrelationId,
          requiresAck: true,
          messageId: `sync_error_${Date.now()}`
        });
        return;
      }

      // Optimized processing: fetch last message and unread count separately for better performance
      const processedConversations = await Promise.all(conversations.map(async (conv) => {
        // Get last message for this conversation
        const { data: lastMessageData } = await supabaseAdmin
          .from('messages')
          .select('id, content, created_at, sender_is_user, message_type')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count (messages from contact, not user)
        const { count: unreadCount } = await supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('sender_is_user', false);
        
        return {
          ...conv,
          lastMessage: lastMessageData || null,
          unreadCount: unreadCount || 0
        };
      }));

      const syncTimestamp = new Date().toISOString();
      
      logger.info('WebSocket', `Sync completed successfully for user: ${socket.userId}`, syncCorrelationId, {
        userId: socket.userId,
        conversationsFound: processedConversations.length,
        syncTimestamp,
        hasTimestampFilter: !!data.lastSyncTimestamp
      });

      // Send sync response via WebSocket
      socket.emit('sync_response', {
        success: true,
        conversations: processedConversations,
        syncTimestamp,
        totalFound: processedConversations.length,
        hasMore: processedConversations.length === 50,
        correlationId: syncCorrelationId,
        requiresAck: true,
        messageId: `sync_response_${Date.now()}`
      });

    } catch (error) {
      logger.error('WebSocket', 'Fatal error during WebSocket sync', syncCorrelationId, {
        userId: socket.userId,
        error: error.message,
        stack: error.stack
      });
      
      socket.emit('sync_response', {
        success: false,
        error: 'Erro interno durante sincronização',
        details: error.message,
        correlationId: syncCorrelationId,
        requiresAck: true,
        messageId: `sync_error_${Date.now()}`
      });
    }
  });

  // Desconexão
  socket.on('disconnect', (reason) => {
    const disconnectCorrelationId = logger.generateCorrelationId();
    
    if (socket.userId) {
      // Calculate connection duration for metrics
      const connectionInfo = connectionTracker.getConnectionInfo(socket.userId);
      const connectionDuration = connectionInfo ? 
        Date.now() - new Date(connectionInfo.connectedAt).getTime() : 0;
      
      connectedUsers.delete(socket.userId);
      connectionTracker.removeConnection(socket.userId);
      heartbeatManager.unregisterClient(socket.userId);
      
      // Record disconnection metrics
      metricsCollector.recordDisconnection(connectionDuration);
      
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
    
    // Record connection error metrics
    metricsCollector.recordConnectionError();
  });
});

// Enhanced function to notify user via WebSocket with batching, delivery tracking, acknowledgment, and offline queuing
function notifyUser(userId, event, data, correlationId = null, requiresAck = true, enableBatching = true) {
  const notifyCorrelationId = correlationId || logger.generateCorrelationId();
  const socketId = connectedUsers.get(userId);
  
  // Generate unique message ID for acknowledgment tracking
  const messageId = data.messageId || `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add correlation ID, timestamp, and acknowledgment info to message
  const enhancedData = {
    ...data,
    messageId,
    correlationId: notifyCorrelationId,
    timestamp: new Date().toISOString(),
    requiresAck
  };

  if (socketId) {
    try {
      // Use batching for non-critical messages to improve performance
      if (enableBatching && event === 'new_message') {
        messageBatcher.addMessage(userId, event, enhancedData, notifyCorrelationId);
        
        // Track message for acknowledgment if required
        if (requiresAck) {
          messageAckManager.addPendingMessage(messageId, userId, notifyCorrelationId, event, enhancedData);
        }
        
        logger.debug('WebSocket', `Event '${event}' added to batch for user: ${userId}`, notifyCorrelationId, {
          userId,
          event,
          messageId,
          requiresAck
        });
        
        return { success: true, batched: true, correlationId: notifyCorrelationId, messageId };
      } else {
        // Send immediately for critical messages
        io.to(socketId).emit(event, enhancedData);
        
        // Track message for acknowledgment if required
        if (requiresAck) {
          messageAckManager.addPendingMessage(messageId, userId, notifyCorrelationId, event, enhancedData);
        }
        
        connectionTracker.incrementMessagesSent(userId);
        connectionTracker.messageStats.delivered++;
        
        logger.info('WebSocket', `Event '${event}' sent immediately to user: ${userId}`, notifyCorrelationId, {
          userId,
          socketId,
          event,
          messageId,
          requiresAck,
          dataSize: JSON.stringify(data).length
        });
        
        return { success: true, correlationId: notifyCorrelationId, messageId };
      }
    } catch (error) {
      connectionTracker.messageStats.failed++;
      logger.error('WebSocket', `Failed to send event '${event}' to user: ${userId}`, notifyCorrelationId, {
        userId,
        socketId,
        event,
        error: error.message
      });
      
      // Queue message if delivery failed due to connection issues
      if (error.message.includes('socket') || error.message.includes('connection')) {
        const queuedMessageId = messageQueue.queueMessage(userId, event, data, notifyCorrelationId);
        logger.info('WebSocket', `Message queued due to delivery failure: ${queuedMessageId}`, notifyCorrelationId, {
          userId,
          event,
          originalError: error.message
        });
      }
      
      return { success: false, error: error.message, correlationId: notifyCorrelationId };
    }
  } else {
    // User is offline, queue the message
    const queuedMessageId = messageQueue.queueMessage(userId, event, data, notifyCorrelationId);
    
    logger.info('WebSocket', `User offline, message queued: ${queuedMessageId}`, notifyCorrelationId, {
      userId,
      event,
      messageId: queuedMessageId,
      totalConnectedUsers: connectedUsers.size
    });
    
    return { 
      success: true, 
      queued: true, 
      messageId: queuedMessageId,
      correlationId: notifyCorrelationId 
    };
  }
}

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Enhanced health check with metrics
app.get('/api/health', (_req, res) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  logger.info('Health', 'Health check requested', correlationId);
  
  try {
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
      correlationId,
      uptime: metricsCollector.getMetrics().uptime.formatted,
      version: process.version,
      memoryUsage: metricsCollector.getLatestMemoryUsage()
    };
    
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    metricsCollector.recordHealthCheck(true);
    
    logger.info('Health', 'Health check response sent', correlationId, {
      ...healthData,
      responseTime: `${responseTime}ms`
    });
    
    res.json(healthData);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    metricsCollector.recordHealthCheck(false);
    
    logger.error('Health', 'Health check failed', correlationId, {
      error: error.message,
      responseTime: `${responseTime}ms`
    });
    
    res.status(500).json({
      ok: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId
    });
  }
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
  const ackStats = messageAckManager.getPendingStats();
  
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    activeConnections: stats.activeConnections,
    messageStats: stats.messageStats,
    acknowledgmentStats: {
      pendingAcknowledgments: ackStats.totalPending,
      pendingMessages: ackStats.pendingMessages
    },
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

app.get('/api/debug/websocket/acknowledgments', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket acknowledgment status requested', correlationId);
  
  const ackStats = messageAckManager.getPendingStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    summary: {
      totalPending: ackStats.totalPending,
      ackTimeout: messageAckManager.ackTimeout,
      maxRetries: messageAckManager.maxRetries,
      retryDelay: messageAckManager.retryDelay
    },
    pendingMessages: ackStats.pendingMessages.map(msg => ({
      ...msg,
      pendingTimeFormatted: `${Math.round(msg.pendingTime / 1000)}s`
    }))
  };
  
  logger.info('Debug', 'WebSocket acknowledgment status sent', correlationId, {
    totalPending: ackStats.totalPending
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/heartbeat', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket heartbeat status requested', correlationId);
  
  const heartbeatStats = heartbeatManager.getHeartbeatStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    heartbeatConfig: {
      interval: heartbeatManager.heartbeatInterval,
      timeout: heartbeatManager.heartbeatTimeout,
      maxMissedHeartbeats: heartbeatManager.maxMissedHeartbeats
    },
    stats: heartbeatStats
  };
  
  logger.info('Debug', 'WebSocket heartbeat status sent', correlationId, {
    totalClients: heartbeatStats.totalClients,
    activeClients: heartbeatStats.activeClients,
    staleClients: heartbeatStats.staleClients
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/queue', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket message queue status requested', correlationId);
  
  const queueStats = messageQueue.getQueueStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    queueConfig: {
      maxQueueSize: messageQueue.maxQueueSize,
      messageExpirationTime: messageQueue.messageExpirationTime,
      cleanupInterval: messageQueue.cleanupInterval
    },
    stats: queueStats
  };
  
  logger.info('Debug', 'WebSocket message queue status sent', correlationId, {
    totalQueues: queueStats.totalQueues,
    totalMessages: queueStats.totalMessages
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/queue/:userId', (req, res) => {
  const { userId } = req.params;
  const correlationId = logger.generateCorrelationId();
  
  logger.info('Debug', `WebSocket user queue status requested: ${userId}`, correlationId);
  
  const userQueue = messageQueue.queues.get(userId) || [];
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    userId,
    queueSize: userQueue.length,
    messages: userQueue.map(msg => ({
      messageId: msg.messageId,
      event: msg.event,
      queuedAt: new Date(msg.queuedAt).toISOString(),
      age: `${Math.round((Date.now() - msg.queuedAt) / 1000)}s`,
      retryCount: msg.retryCount,
      correlationId: msg.correlationId
    }))
  };
  
  logger.info('Debug', `WebSocket user queue status sent: ${userId}`, correlationId, {
    queueSize: userQueue.length
  });
  
  res.json(response);
});

app.get('/api/debug/websocket/batching', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'WebSocket message batching status requested', correlationId);
  
  const batchStats = messageBatcher.getBatchStats();
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    batchingConfig: {
      batchSize: messageBatcher.batchSize,
      batchTimeout: messageBatcher.batchTimeout
    },
    stats: batchStats
  };
  
  logger.info('Debug', 'WebSocket message batching status sent', correlationId, {
    activeBatches: batchStats.activeBatches,
    totalBatches: batchStats.totalBatches,
    averageBatchSize: batchStats.averageBatchSize
  });
  
  res.json(response);
});

app.post('/api/debug/websocket/batching/flush', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Debug', 'Manual batch flush requested', correlationId);
  
  const statsBefore = messageBatcher.getBatchStats();
  messageBatcher.flushAllBatches();
  const statsAfter = messageBatcher.getBatchStats();
  
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    flushedBatches: statsBefore.activeBatches,
    batchesBefore: statsBefore,
    batchesAfter: statsAfter,
    success: true
  };
  
  logger.info('Debug', 'Manual batch flush completed', correlationId, {
    flushedBatches: statsBefore.activeBatches
  });
  
  res.json(response);
});

// Comprehensive metrics endpoint
app.get('/api/metrics', (_req, res) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  logger.info('Metrics', 'Metrics requested', correlationId);
  
  try {
    const metrics = metricsCollector.getMetrics();
    const responseTime = Date.now() - startTime;
    
    const response = {
      correlationId,
      responseTime: `${responseTime}ms`,
      ...metrics
    };
    
    metricsCollector.recordResponseTime(responseTime);
    
    logger.info('Metrics', 'Metrics response sent', correlationId, {
      responseTime: `${responseTime}ms`,
      metricsSize: JSON.stringify(metrics).length
    });
    
    res.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    
    logger.error('Metrics', 'Failed to get metrics', correlationId, {
      error: error.message,
      responseTime: `${responseTime}ms`
    });
    
    res.status(500).json({
      error: 'Failed to collect metrics',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Prometheus-compatible metrics endpoint
app.get('/api/metrics/prometheus', (_req, res) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  logger.info('Metrics', 'Prometheus metrics requested', correlationId);
  
  try {
    const prometheusMetrics = metricsCollector.exportPrometheusMetrics();
    const responseTime = Date.now() - startTime;
    
    metricsCollector.recordResponseTime(responseTime);
    
    logger.info('Metrics', 'Prometheus metrics response sent', correlationId, {
      responseTime: `${responseTime}ms`,
      metricsSize: prometheusMetrics.length
    });
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    
    logger.error('Metrics', 'Failed to export Prometheus metrics', correlationId, {
      error: error.message,
      responseTime: `${responseTime}ms`
    });
    
    res.status(500).send(`# Error exporting metrics: ${error.message}`);
  }
});

// Performance monitoring endpoint
app.get('/api/monitoring/performance', (_req, res) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  logger.info('Monitoring', 'Performance monitoring requested', correlationId);
  
  try {
    const metrics = metricsCollector.getMetrics();
    const connectionStats = connectionTracker.getStats();
    const ackStats = messageAckManager.getPendingStats();
    const heartbeatStats = heartbeatManager.getHeartbeatStats();
    const queueStats = messageQueue.getQueueStats();
    const batchStats = messageBatcher.getBatchStats();
    
    const response = {
      correlationId,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      performance: {
        uptime: metrics.uptime,
        memory: metrics.performance.memory,
        cpu: metrics.performance.cpu,
        responseTime: metrics.performance.responseTime,
        throughput: metrics.messages.throughput
      },
      websocket: {
        connections: {
          current: connectionStats.activeConnections,
          peak: metrics.connections.peak,
          total: metrics.connections.total
        },
        messages: {
          sent: metrics.messages.sent,
          received: metrics.messages.received,
          batches: metrics.messages.batches,
          pending: ackStats.totalPending,
          queued: queueStats.totalMessages
        },
        heartbeat: {
          active: heartbeatStats.activeClients,
          stale: heartbeatStats.staleClients,
          total: heartbeatStats.totalClients
        },
        batching: {
          active: batchStats.activeBatches,
          totalSent: batchStats.totalBatches,
          averageSize: batchStats.averageBatchSize
        }
      },
      errors: metrics.errors,
      health: {
        status: 'healthy',
        checks: metrics.health.checks,
        successRate: `${metrics.health.successRate}%`
      }
    };
    
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    
    logger.info('Monitoring', 'Performance monitoring response sent', correlationId, {
      responseTime: `${responseTime}ms`
    });
    
    res.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    
    logger.error('Monitoring', 'Failed to get performance monitoring data', correlationId, {
      error: error.message,
      responseTime: `${responseTime}ms`
    });
    
    res.status(500).json({
      error: 'Failed to collect performance data',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Error rate monitoring endpoint
app.get('/api/monitoring/errors', (_req, res) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  logger.info('Monitoring', 'Error monitoring requested', correlationId);
  
  try {
    const metrics = metricsCollector.getMetrics();
    const responseTime = Date.now() - startTime;
    
    const response = {
      correlationId,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      errors: {
        total: metrics.errors.total,
        breakdown: {
          connections: metrics.errors.connections,
          messages: metrics.errors.messages,
          webhooks: metrics.errors.webhooks,
          syncs: metrics.errors.syncs
        },
        rates: {
          connectionErrorRate: metrics.connections.total > 0 ? 
            Math.round((metrics.errors.connections / metrics.connections.total) * 100) : 0,
          messageErrorRate: metrics.messages.sent > 0 ? 
            Math.round((metrics.errors.messages / metrics.messages.sent) * 100) : 0,
          overallErrorRate: (metrics.connections.total + metrics.messages.sent) > 0 ?
            Math.round((metrics.errors.total / (metrics.connections.total + metrics.messages.sent)) * 100) : 0
        }
      },
      health: {
        status: metrics.errors.total < 10 ? 'healthy' : metrics.errors.total < 50 ? 'warning' : 'critical',
        healthScore: Math.max(0, 100 - (metrics.errors.total * 2)) // Simple health score
      }
    };
    
    metricsCollector.recordResponseTime(responseTime);
    
    logger.info('Monitoring', 'Error monitoring response sent', correlationId, {
      responseTime: `${responseTime}ms`,
      totalErrors: metrics.errors.total
    });
    
    res.json(response);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordResponseTime(responseTime);
    
    logger.error('Monitoring', 'Failed to get error monitoring data', correlationId, {
      error: error.message,
      responseTime: `${responseTime}ms`
    });
    
    res.status(500).json({
      error: 'Failed to collect error data',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset metrics endpoint (for testing/maintenance)
app.post('/api/metrics/reset', (_req, res) => {
  const correlationId = logger.generateCorrelationId();
  logger.info('Metrics', 'Metrics reset requested', correlationId);
  
  try {
    const oldMetrics = metricsCollector.getMetrics();
    metricsCollector.reset();
    
    const response = {
      correlationId,
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Metrics reset successfully',
      previousMetrics: {
        uptime: oldMetrics.uptime.formatted,
        totalConnections: oldMetrics.connections.total,
        totalMessages: oldMetrics.messages.sent,
        totalErrors: oldMetrics.errors.total
      }
    };
    
    logger.info('Metrics', 'Metrics reset completed', correlationId, response.previousMetrics);
    
    res.json(response);
  } catch (error) {
    logger.error('Metrics', 'Failed to reset metrics', correlationId, {
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to reset metrics',
      details: error.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/debug/websocket/queue/:userId/clear', (req, res) => {
  const { userId } = req.params;
  const correlationId = logger.generateCorrelationId();
  
  logger.info('Debug', `WebSocket user queue clear requested: ${userId}`, correlationId);
  
  const clearedCount = messageQueue.clearUserQueue(userId);
  const response = {
    correlationId,
    timestamp: new Date().toISOString(),
    userId,
    clearedMessages: clearedCount,
    success: true
  };
  
  logger.info('Debug', `WebSocket user queue cleared: ${userId}`, correlationId, {
    clearedMessages: clearedCount
  });
  
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
            
            // Record successful message metrics
            metricsCollector.recordMessageSent();
          } else {
            logger.warn('Webhook', `Failed to send WebSocket notification to user ${ownerUserId}`, messageCorrelationId, {
              ownerUserId,
              messageId: key.id,
              error: notifyResult.error
            });
            
            // Record message error metrics
            metricsCollector.recordMessageError();
          }

        } catch (error) {
          logger.error('Webhook', `Fatal error processing message ${key.id}`, messageCorrelationId, {
            messageId: key.id,
            ownerUserId,
            phone,
            error: error.message,
            stack: error.stack
          });
          
          // Record webhook error metrics
          metricsCollector.recordWebhookError();
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

// Enhanced sync endpoint for conversations with timestamp-based filtering
app.post('/api/sync/conversations', async (req, res) => {
  const correlationId = req.correlationId || logger.generateCorrelationId();
  const userId = req.headers['x-user-id'] || req.body.userId;
  const { lastSyncTimestamp, limit = 50 } = req.body;
  
  logger.info('Sync', `Conversation sync requested by user: ${userId}`, correlationId, {
    userId,
    lastSyncTimestamp,
    limit
  });
  
  if (!userId) {
    logger.error('Sync', 'userId not provided for sync request', correlationId);
    return res.status(400).json({ 
      error: 'userId é obrigatório',
      correlationId 
    });
  }

  if (!supabaseAdmin) {
    logger.error('Sync', 'Supabase not available for sync', correlationId);
    return res.status(500).json({ 
      error: 'Banco de dados não disponível',
      correlationId 
    });
  }

  try {
    // Optimized query for conversations with selective field loading
    let conversationQuery = supabaseAdmin
      .from('conversations')
      .select(`
        id,
        user_id,
        contact_id,
        status,
        created_at,
        updated_at,
        contacts!inner (
          id,
          name,
          phone_number,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    // Apply timestamp filter if provided for better performance
    if (lastSyncTimestamp) {
      conversationQuery = conversationQuery.gt('updated_at', lastSyncTimestamp);
      logger.debug('Sync', `Filtering conversations updated after: ${lastSyncTimestamp}`, correlationId);
    }

    // Apply limit
    conversationQuery = conversationQuery.limit(limit);

    const { data: conversations, error } = await conversationQuery;
    
    if (error) {
      logger.error('Sync', 'Failed to fetch conversations for sync', correlationId, {
        userId,
        error: error.message
      });
      
      // Record sync error metrics
      metricsCollector.recordSyncError();
      
      return res.status(500).json({ 
        error: 'Erro ao buscar conversas',
        details: error.message,
        correlationId 
      });
    }

    // Optimized processing: fetch last message and unread count separately for better performance
    const processedConversations = await Promise.all(conversations.map(async (conv) => {
      // Get last message for this conversation
      const { data: lastMessageData } = await supabaseAdmin
        .from('messages')
        .select('id, content, created_at, sender_is_user, message_type')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get unread count (messages from contact, not user)
      const { count: unreadCount } = await supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('sender_is_user', false);
      
      return {
        ...conv,
        lastMessage: lastMessageData || null,
        unreadCount: unreadCount || 0
      };
    }));

    const syncTimestamp = new Date().toISOString();
    
    logger.info('Sync', `Sync completed successfully for user: ${userId}`, correlationId, {
      userId,
      conversationsFound: processedConversations.length,
      syncTimestamp,
      hasTimestampFilter: !!lastSyncTimestamp
    });

    res.json({
      success: true,
      conversations: processedConversations,
      syncTimestamp,
      totalFound: processedConversations.length,
      hasMore: processedConversations.length === limit,
      correlationId
    });

  } catch (error) {
    logger.error('Sync', 'Fatal error during conversation sync', correlationId, {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Erro interno durante sincronização',
      details: error.message,
      correlationId
    });
  }
});

// Enhanced sync endpoint for messages with conversation-specific filtering
app.post('/api/sync/messages/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const correlationId = req.correlationId || logger.generateCorrelationId();
  const userId = req.headers['x-user-id'] || req.body.userId;
  const { lastSyncTimestamp, limit = 100 } = req.body;
  
  logger.info('Sync', `Message sync requested for conversation: ${conversationId}`, correlationId, {
    userId,
    conversationId,
    lastSyncTimestamp,
    limit
  });
  
  if (!userId) {
    logger.error('Sync', 'userId not provided for message sync', correlationId);
    return res.status(400).json({ 
      error: 'userId é obrigatório',
      correlationId 
    });
  }

  if (!supabaseAdmin) {
    logger.error('Sync', 'Supabase not available for message sync', correlationId);
    return res.status(500).json({ 
      error: 'Banco de dados não disponível',
      correlationId 
    });
  }

  try {
    // Verify user owns the conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      logger.error('Sync', `Conversation not found or access denied: ${conversationId}`, correlationId, {
        userId,
        conversationId,
        error: convError?.message
      });
      return res.status(404).json({ 
        error: 'Conversa não encontrada ou acesso negado',
        correlationId 
      });
    }

    // Build query for messages with timestamp filtering
    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender_profile:profiles!messages_internal_sender_id_fkey (
          id,
          name,
          email,
          role
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Apply timestamp filter if provided
    if (lastSyncTimestamp) {
      query = query.gt('created_at', lastSyncTimestamp);
      logger.debug('Sync', `Filtering messages created after: ${lastSyncTimestamp}`, correlationId);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: messages, error } = await query;
    
    if (error) {
      logger.error('Sync', 'Failed to fetch messages for sync', correlationId, {
        userId,
        conversationId,
        error: error.message
      });
      return res.status(500).json({ 
        error: 'Erro ao buscar mensagens',
        details: error.message,
        correlationId 
      });
    }

    const syncTimestamp = new Date().toISOString();
    
    logger.info('Sync', `Message sync completed for conversation: ${conversationId}`, correlationId, {
      userId,
      conversationId,
      messagesFound: messages.length,
      syncTimestamp,
      hasTimestampFilter: !!lastSyncTimestamp
    });

    res.json({
      success: true,
      messages: messages || [],
      syncTimestamp,
      totalFound: messages?.length || 0,
      hasMore: (messages?.length || 0) === limit,
      correlationId
    });

  } catch (error) {
    logger.error('Sync', 'Fatal error during message sync', correlationId, {
      userId,
      conversationId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Erro interno durante sincronização de mensagens',
      details: error.message,
      correlationId
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

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('Server', 'SIGTERM received, shutting down gracefully');
  
  // Log final metrics before shutdown
  const finalMetrics = metricsCollector.getMetrics();
  logger.info('Server', 'Final metrics before shutdown', null, {
    uptime: finalMetrics.uptime.formatted,
    totalConnections: finalMetrics.connections.total,
    totalMessages: finalMetrics.messages.sent,
    totalErrors: finalMetrics.errors.total
  });
  
  heartbeatManager.stopServerHeartbeat();
  messageBatcher.cleanup();
  messageAckManager.cleanup();
  messageQueue.cleanup();
  server.close(() => {
    logger.info('Server', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Server', 'SIGINT received, shutting down gracefully');
  
  // Log final metrics before shutdown
  const finalMetrics = metricsCollector.getMetrics();
  logger.info('Server', 'Final metrics before shutdown', null, {
    uptime: finalMetrics.uptime.formatted,
    totalConnections: finalMetrics.connections.total,
    totalMessages: finalMetrics.messages.sent,
    totalErrors: finalMetrics.errors.total
  });
  
  heartbeatManager.stopServerHeartbeat();
  messageBatcher.cleanup();
  messageAckManager.cleanup();
  messageQueue.cleanup();
  server.close(() => {
    logger.info('Server', 'Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  const startupCorrelationId = logger.generateCorrelationId();
  
  // Start heartbeat system
  heartbeatManager.startServerHeartbeat();
  
  logger.info('Server', `Backend WebSocket server started on http://localhost:${PORT}`, startupCorrelationId, {
    port: PORT,
    evolutionApiUrl: EVOLUTION_API_URL || 'NOT_CONFIGURED',
    evolutionApiKey: EVOLUTION_API_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
    supabase: SUPABASE_AVAILABLE ? 'AVAILABLE' : 'DISABLED',
    websocket: 'ENABLED',
    messageAckTimeout: messageAckManager.ackTimeout,
    messageMaxRetries: messageAckManager.maxRetries,
    heartbeatInterval: heartbeatManager.heartbeatInterval,
    heartbeatTimeout: heartbeatManager.heartbeatTimeout,
    maxMissedHeartbeats: heartbeatManager.maxMissedHeartbeats,
    messageQueueMaxSize: messageQueue.maxQueueSize,
    messageQueueExpirationTime: messageQueue.messageExpirationTime,
    messageQueueCleanupInterval: messageQueue.cleanupInterval,
    messageBatchSize: messageBatcher.batchSize,
    messageBatchTimeout: messageBatcher.batchTimeout,
    metricsEnabled: 'ENABLED',
    metricsMaxArraySize: metricsCollector.maxArraySize,
    logLevel: logger.logLevel,
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  // Log startup configuration
  console.log(`\x1b[32m[OK]\x1b[0m Backend WebSocket server rodando em http://localhost:${PORT}`);
  console.log(`[Config] Evolution API URL: ${EVOLUTION_API_URL || 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Evolution API Key: ${EVOLUTION_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Supabase: ${SUPABASE_AVAILABLE ? 'Disponível' : 'Desabilitado'}`);
  console.log(`[Config] WebSocket: Habilitado`);
  console.log(`[Config] Message Acknowledgment: Habilitado (${messageAckManager.ackTimeout}ms timeout, ${messageAckManager.maxRetries} retries)`);
  console.log(`[Config] Heartbeat System: Habilitado (${heartbeatManager.heartbeatInterval}ms interval, ${heartbeatManager.heartbeatTimeout}ms timeout, max ${heartbeatManager.maxMissedHeartbeats} missed)`);
  console.log(`[Config] Message Queue: Habilitado (max ${messageQueue.maxQueueSize} messages, ${Math.round(messageQueue.messageExpirationTime / 1000 / 60 / 60)}h expiration, ${Math.round(messageQueue.cleanupInterval / 1000 / 60)}min cleanup)`);
  console.log(`[Config] Message Batching: Habilitado (max ${messageBatcher.batchSize} messages per batch, ${messageBatcher.batchTimeout}ms timeout)`);
  console.log(`[Config] Metrics Collection: Habilitado (max ${metricsCollector.maxArraySize} samples per metric)`);
  console.log(`[Config] Log Level: ${logger.logLevel.toUpperCase()}`);
  console.log(`[Config] Startup Correlation ID: ${startupCorrelationId}`);
});