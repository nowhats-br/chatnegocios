const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

dotenv.config();

// Verificação Crítica de Variáveis de Ambiente
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31m[FATAL]\x1b[0m Variáveis de ambiente do Supabase (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY) não estão definidas. O backend não pode iniciar.');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
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

// Cliente Admin do Supabase
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  try {
    const payload = req.body || {};
    const instanceName = payload.instance;
    const eventType = String(payload.event || '').toLowerCase();
    const ownerUserId = req.headers['x-user-id'];

    if (!ownerUserId) {
      console.error(`[Webhook] Erro crítico: user_id não encontrado no header para o evento da instância '${instanceName}'.`);
      return res.status(400).json({ error: 'x-user-id header é obrigatório' });
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
