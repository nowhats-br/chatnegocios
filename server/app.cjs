const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'alive', timestamp: new Date().toISOString() });
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
      const statusMap = {
        'open': 'CONNECTED',
        'close': 'DISCONNECTED',
        'connecting': 'INITIALIZING',
      };
      const newStatus = statusMap[payload.data?.state] || 'DISCONNECTED';
      const { error } = await supabaseAdmin
        .from('connections')
        .update({ status: newStatus, instance_data: payload.data })
        .eq('instance_name', instanceName)
        .eq('user_id', ownerUserId);
      if (error) console.error(`[Webhook] Erro ao atualizar status da conexão '${instanceName}':`, error.message);
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
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
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
          message_type: 'text',
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

// Rota fallback para servir o index.html em rotas de frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (require('fs').existsSync(distPath)) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).send('Frontend não buildado. Execute `npm run build`.');
  }
});

app.listen(PORT, () => {
  console.log(`\x1b[32m[OK]\x1b[0m Backend (webhook) server rodando em http://localhost:${PORT}`);
});

// Proxy para Evolution API para evitar CORS e centralizar credenciais
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

app.all('/api/evolution/*', async (req, res) => {
  if (!EVOLUTION_API_URL) {
    return res.status(500).json({ error: 'EVOLUTION_API_URL não configurado no backend.' });
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
    ...(EVOLUTION_API_KEY ? { Authorization: `Bearer ${EVOLUTION_API_KEY}` } : {}),
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
    res.status(502).json({ error: msg });
  }
});
