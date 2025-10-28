const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

dotenv.config();

// Verificação Crítica de Variáveis de Ambiente
const SUPABASE_AVAILABLE = /^https?:\/\//.test(process.env.SUPABASE_URL || '') && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_AVAILABLE) {
  console.warn('\x1b[33m[WARN]\x1b[0m Variáveis do Supabase não definidas. Webhook de persistência desabilitado.');
}

const PORT = Number(process.env.PORT) || 3001;
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
];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

const corsOptions = process.env.CORS_ALLOW_ALL === 'true'
  ? { origin: true, credentials: true }
  : {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Bloqueada origem não permitida: ${origin}`);
        callback(new Error('Not allowed by CORS'));
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

// Configuração do WebSocket
io.on('connection', (socket) => {
  console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

  // Registrar usuário
  socket.on('register', (userId) => {
    if (userId) {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`[WebSocket] Usuário ${userId} registrado com socket ${socket.id}`);
      
      // Confirmar registro
      socket.emit('registered', { userId, socketId: socket.id });
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log(`[WebSocket] Usuário ${socket.userId} desconectado`);
    }
  });
});

// Função para notificar usuário via WebSocket
function notifyUser(userId, event, data) {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
    console.log(`[WebSocket] Evento '${event}' enviado para usuário ${userId}`);
    return true;
  }
  return false;
}

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check
app.get('/api/health', (_req, res) => {
  console.log('[Health] Health check solicitado');
  const healthData = {
    ok: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    evolutionApiUrl: EVOLUTION_API_URL ? 'configurada' : 'não configurada',
    evolutionApiKey: EVOLUTION_API_KEY ? 'configurada' : 'não configurada',
    port: PORT,
    websocket: 'enabled',
    connectedUsers: connectedUsers.size,
    supabase: SUPABASE_AVAILABLE ? 'disponível' : 'indisponível'
  };
  console.log('[Health] Respondendo:', healthData);
  res.json(healthData);
});

// Endpoint de debug para testar configuração
app.get('/api/debug/webhook-config', (_req, res) => {
  console.log('[Debug] Verificando configuração do webhook');
  res.json({
    evolutionApiUrl: EVOLUTION_API_URL,
    evolutionApiKey: EVOLUTION_API_KEY ? '***configurada***' : 'não configurada',
    supabaseAvailable: SUPABASE_AVAILABLE,
    connectedUsers: connectedUsers.size,
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'não configurada (usando request host)',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para testar conexão com Evolution API
app.get('/api/debug/test-evolution', async (_req, res) => {
  console.log('[Debug] Testando conexão com Evolution API');

  if (!EVOLUTION_API_URL) {
    return res.status(500).json({
      success: false,
      error: 'EVOLUTION_API_URL não configurado no backend'
    });
  }

  if (!EVOLUTION_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'EVOLUTION_API_KEY não configurado no backend'
    });
  }

  try {
    const testUrl = `${EVOLUTION_API_URL}/manager/findInstances`;
    console.log(`[Debug] Testando URL: ${testUrl}`);

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

    console.log(`[Debug] Resposta: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      res.json({
        success: true,
        message: 'Conexão com Evolution API estabelecida com sucesso',
        status: response.status,
        data: data
      });
    } else {
      const errorText = await response.text().catch(() => '');
      res.status(response.status).json({
        success: false,
        error: `Evolution API retornou status ${response.status}`,
        details: errorText
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Debug] Erro ao testar Evolution API:', msg);
    res.status(502).json({
      success: false,
      error: `Erro ao conectar com Evolution API: ${msg}`
    });
  }
});

// Webhook para receber eventos da Evolution API
app.post('/api/whatsapp/webhook', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(200).json({ ok: true, warning: 'Supabase desabilitado no backend.' });
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

    console.log(`[Webhook] Evento recebido: ${eventType} para instância ${instanceName} do usuário ${ownerUserId}`);

    if (!ownerUserId) {
      console.error(`[Webhook] Erro crítico: user_id não encontrado para o evento da instância '${instanceName}'.`);
      return res.status(400).json({ error: 'x-user-id header ou uid query é obrigatório' });
    }

    if (eventType === 'connection.update') {
      // Verificar status atual antes de atualizar
      const { data: currentConnection } = await supabaseAdmin
        .from('connections')
        .select('status')
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId)
        .single();

      // Se a conexão está pausada, não atualizar o status
      if (currentConnection?.status === 'PAUSED') {
        console.log(`[Webhook] Conexão '${instanceName}' está pausada, ignorando atualização de status`);
        return res.status(200).json({ ok: true, message: 'Status ignorado - conexão pausada' });
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
          console.error(`[Webhook] Erro ao atualizar status da conexão '${instanceName}':`, error.message);
        } else {
          // Notificar via WebSocket
          notifyUser(ownerUserId, 'connection_update', {
            instanceName,
            status: newStatus,
            data: payload.data
          });
        }
      }
    }

    else if (eventType === 'qrcode.updated') {
      const { error } = await supabaseAdmin
        .from('connections')
        .update({ status: 'WAITING_QR_CODE' })
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId);
      
      if (error) {
        console.error(`[Webhook] Erro ao atualizar status para WAITING_QR_CODE na instância '${instanceName}':`, error.message);
      } else {
        // Notificar via WebSocket
        notifyUser(ownerUserId, 'qrcode_update', {
          instanceName,
          qrcode: payload.data?.qrcode
        });
      }
    }

    else if (eventType === 'messages.upsert') {
      const messages = payload.data.messages || [];
      console.log(`[Webhook] Processando ${messages.length} mensagens`);
      
      for (const msg of messages) {
        const key = msg.key || {};
        if (key.fromMe) {
          console.log(`[Webhook] Ignorando mensagem própria: ${key.id}`);
          continue;
        }

        const remoteJid = key.remoteJid || '';
        if (!remoteJid || remoteJid.endsWith('@g.us')) {
          console.log(`[Webhook] Ignorando mensagem de grupo: ${remoteJid}`);
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
          console.log(`[Webhook] Dados insuficientes para processar mensagem: phone=${phone}, content=${messageContent}`);
          continue;
        }

        console.log(`[Webhook] Processando mensagem de ${pushName} (${phone}): ${messageContent.substring(0, 50)}...`);

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
            console.error(`[Webhook] Erro ao salvar contato ${phone}:`, contactError.message);
            continue;
          }

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
            console.error(`[Webhook] Erro ao salvar conversa para ${phone}:`, convError.message);
            continue;
          }

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
            console.error(`[Webhook] Erro ao inserir mensagem ${key.id}:`, msgError.message);
            continue;
          }

          console.log(`[Webhook] ✅ Mensagem processada com sucesso: ${key.id}`);

          // Notificar via WebSocket em tempo real
          const notified = notifyUser(ownerUserId, 'new_message', {
            conversationId: conversation.id,
            contactId: contact.id,
            contactName: pushName,
            contactPhone: phone,
            messageId: key.id,
            content: messageContent,
            messageType: messageType,
            timestamp: new Date().toISOString()
          });

          if (notified) {
            console.log(`[Webhook] ✅ Notificação WebSocket enviada para usuário ${ownerUserId}`);
          } else {
            console.log(`[Webhook] ⚠️ Usuário ${ownerUserId} não está conectado via WebSocket`);
          }

        } catch (error) {
          console.error(`[Webhook] Erro ao processar mensagem ${key.id}:`, error.message);
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[Webhook] Erro fatal no processamento:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint para configurar webhook na Evolution API
app.post('/api/whatsapp/setup-webhook/:instanceName', async (req, res) => {
  const { instanceName } = req.params;
  const userId = req.headers['x-user-id'] || req.body.userId;
  
  console.log(`[Setup] Iniciando configuração de webhook para instância: ${instanceName}, userId: ${userId}`);
  
  if (!userId) {
    console.error('[Setup] ❌ userId não fornecido');
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('[Setup] ❌ Evolution API não configurada');
    console.error(`[Setup] EVOLUTION_API_URL: ${EVOLUTION_API_URL ? 'OK' : 'MISSING'}`);
    console.error(`[Setup] EVOLUTION_API_KEY: ${EVOLUTION_API_KEY ? 'OK' : 'MISSING'}`);
    return res.status(500).json({ error: 'Evolution API não configurada no servidor' });
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

    console.log(`[Setup] Configurando webhook para ${instanceName}:`);
    console.log(`[Setup] URL do webhook: ${webhookUrl}`);
    console.log(`[Setup] Evolution API URL: ${EVOLUTION_API_URL}`);
    console.log(`[Setup] Config do webhook:`, JSON.stringify(webhookConfig, null, 2));

    const targetUrl = `${EVOLUTION_API_URL}/webhook/set/${instanceName}`;
    console.log(`[Setup] Fazendo requisição para: ${targetUrl}`);

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

    console.log(`[Setup] Resposta da Evolution API: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      console.log(`[Setup] ✅ Webhook configurado com sucesso para ${instanceName}`);
      console.log(`[Setup] Dados da resposta:`, data);
      res.json({ 
        success: true, 
        message: 'Webhook configurado com sucesso',
        webhookUrl,
        instanceName,
        data 
      });
    } else {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      console.error(`[Setup] ❌ Erro ao configurar webhook: ${response.status} ${response.statusText}`);
      console.error(`[Setup] Detalhes do erro:`, errorText);
      res.status(response.status).json({ 
        error: `Erro ao configurar webhook: ${response.status} - ${response.statusText}`,
        details: errorText,
        instanceName,
        webhookUrl
      });
    }
  } catch (error) {
    console.error('[Setup] ❌ Erro fatal ao configurar webhook:', error);
    res.status(500).json({ 
      error: error.message,
      instanceName,
      stack: error.stack
    });
  }
});

// Proxy para Evolution API
app.all('/api/evolution/*', async (req, res) => {
  console.log(`[Proxy] ${req.method} ${req.path} -> ${EVOLUTION_API_URL}`);

  if (!EVOLUTION_API_URL) {
    console.error('[Proxy] EVOLUTION_API_URL não configurado');
    return res.status(500).json({ error: 'EVOLUTION_API_URL não configurado no backend.' });
  }

  if (!EVOLUTION_API_KEY) {
    console.error('[Proxy] EVOLUTION_API_KEY não configurado');
    return res.status(500).json({ error: 'EVOLUTION_API_KEY não configurado no backend.' });
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
    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });

    const contentType = resp.headers.get('content-type') || '';
    const status = resp.status;

    if (contentType.includes('application/json')) {
      const json = await resp.json().catch(() => null);
      res.status(status).json(json ?? {});
    } else {
      const text = await resp.text().catch(() => '');
      res.status(status).send(text);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Proxy Evolution] Erro ao encaminhar:', msg);
    res.status(502).json({ error: `Erro no proxy: ${msg}` });
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

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[Error Handler] Erro não tratado:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

server.listen(PORT, () => {
  console.log(`\x1b[32m[OK]\x1b[0m Backend WebSocket server rodando em http://localhost:${PORT}`);
  console.log(`[Config] Evolution API URL: ${EVOLUTION_API_URL}`);
  console.log(`[Config] Evolution API Key: ${EVOLUTION_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Supabase: ${SUPABASE_AVAILABLE ? 'Disponível' : 'Desabilitado'}`);
  console.log(`[Config] WebSocket: Habilitado`);
});