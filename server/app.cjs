const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Verificar se fetch está disponível (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('[FATAL] fetch não está disponível. Node.js 18+ é necessário.');
  process.exit(1);
}

dotenv.config();

// Verificação Crítica de Variáveis de Ambiente
const SUPABASE_AVAILABLE = /^https?:\/\//.test(process.env.SUPABASE_URL || '') && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_AVAILABLE) {
  console.warn('\x1b[33m[WARN]\x1b[0m Variáveis do Supabase não definidas. Webhook de persistência desabilitado, servidor segue para proxy e frontend.');
}

// Corrige tipo da porta: garante um número
const PORT = Number(process.env.PORT) || 3001;
const app = express();

// Configuração de CORS
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])]; // Garante origens únicas

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

// Cliente Admin do Supabase (opcional)
const supabaseAdmin = SUPABASE_AVAILABLE ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;

// Configurações da Evolution API
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

console.log(`[Proxy] Evolution API URL: ${EVOLUTION_API_URL}`);
console.log(`[Proxy] Evolution API Key: ${EVOLUTION_API_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}`);

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('/api/health', (_req, res) => {
  console.log('[Health] Health check solicitado');
  const healthData = {
    ok: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
    evolutionApiUrl: EVOLUTION_API_URL ? 'configurada' : 'não configurada',
    evolutionApiKey: EVOLUTION_API_KEY ? 'configurada' : 'não configurada',
    port: PORT,
    corsAllowAll: process.env.CORS_ALLOW_ALL,
    allowedOrigins: allowedOrigins
  };
  console.log('[Health] Respondendo:', healthData);
  res.json(healthData);
});

// Endpoint de debug para testar o proxy
app.get('/api/debug/proxy-test', (_req, res) => {
  console.log('[Debug] Teste do proxy solicitado');
  res.json({
    message: 'Proxy funcionando',
    evolutionApiUrl: EVOLUTION_API_URL,
    evolutionApiKey: EVOLUTION_API_KEY ? 'configurada' : 'não configurada',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para testar conexão com Evolution API
app.get('/api/test-evolution', async (_req, res) => {
  console.log('[Test] Testando conexão com Evolution API');

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
    console.log(`[Test] Testando URL: ${testUrl}`);

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

    console.log(`[Test] Resposta: ${response.status} ${response.statusText}`);

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
    console.error('[Test] Erro ao testar Evolution API:', msg);
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

    if (!ownerUserId) {
      console.error(`[Webhook] Erro crítico: user_id não encontrado em header nem query para o evento da instância '${instanceName}'.`);
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
        if (error) console.error(`[Webhook] Erro ao atualizar status da conexão '${instanceName}':`, error.message);
      }
    }

    else if (eventType === 'qrcode.updated') {
      const { error } = await supabaseAdmin
        .from('connections')
        .update({ status: 'WAITING_QR_CODE' })
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId);
      if (error) console.error(`[Webhook] Erro ao atualizar status para WAITING_QR_CODE na instância '${instanceName}':`, error.message);
    }

    else if (eventType === 'messages.upsert') {
      const messages = payload.data.messages || [];
      for (const msg of messages) {
        const key = msg.key || {};
        if (key.fromMe) continue;

        const remoteJid = key.remoteJid || '';
        if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

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

        if (!phone || !messageContent) continue;

        const { data: contact, error: contactError } = await supabaseAdmin
          .from('contacts')
          .upsert({ user_id: ownerUserId, phone_number: phone, name: pushName }, { onConflict: 'user_id, phone_number' })
          .select('id')
          .single();
        if (contactError) throw new Error(`Erro ao salvar contato: ${contactError.message}`);

        const { data: connection } = await supabaseAdmin.from('connections').select('id').eq('instance_name', instanceName).eq('user_id', ownerUserId).single();

        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .upsert({ user_id: ownerUserId, contact_id: contact.id, status: 'pending', connection_id: connection?.id || null }, { onConflict: 'user_id, contact_id' })
          .select('id')
          .single();
        if (convError) throw new Error(`Erro ao salvar conversa: ${convError.message}`);

        const { error: msgError } = await supabaseAdmin.from('messages').insert({
          id: key.id,
          conversation_id: conversation.id,
          user_id: ownerUserId,
          sender_is_user: false,
          content: messageContent,
          message_type: messageType,
        });
        if (msgError && msgError.code !== '23505') { // Ignora erro de ID duplicado
          console.error(`[Webhook] Erro ao inserir mensagem ${key.id}:`, msgError.message);
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

// Proxy para Evolution API para evitar CORS e centralizar credenciais
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

  console.log(`[Proxy] Target URL: ${targetUrl}`);

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: EVOLUTION_API_KEY,
    'X-API-Key': EVOLUTION_API_KEY,
    Authorization: `Bearer ${EVOLUTION_API_KEY}`,
  };

  try {
    console.log(`[Proxy] Fazendo requisição para: ${targetUrl}`);

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
    });

    console.log(`[Proxy] Resposta recebida: ${resp.status} ${resp.statusText}`);

    const contentType = resp.headers.get('content-type') || '';
    const status = resp.status;

    if (contentType.includes('application/json')) {
      const json = await resp.json().catch(() => null);
      console.log(`[Proxy] JSON Response:`, json);
      res.status(status).json(json ?? {});
    } else {
      const text = await resp.text().catch(() => '');
      console.log(`[Proxy] Text Response:`, text.substring(0, 200));
      res.status(status).send(text);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Proxy Evolution] Erro ao encaminhar:', msg);
    res.status(502).json({ error: `Erro no proxy: ${msg}` });
  }
});

// Rota fallback para servir o index.html em rotas de frontend
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

app.listen(PORT, () => {
  console.log(`\x1b[32m[OK]\x1b[0m Backend (webhook) server rodando em http://localhost:${PORT}`);
  console.log(`[Config] Evolution API URL: ${EVOLUTION_API_URL}`);
  console.log(`[Config] Evolution API Key: ${EVOLUTION_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA'}`);
  console.log(`[Config] Supabase: ${SUPABASE_AVAILABLE ? 'Disponível' : 'Desabilitado'}`);
});
