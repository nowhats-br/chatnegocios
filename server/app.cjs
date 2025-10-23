const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();

// CORS
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...envOrigins];

const corsOptions = process.env.CORS_ALLOW_ALL === 'true'
  ? { origin: true, credentials: true }
  : {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    };

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' })); // Aumenta o limite para payloads de webhook

// Supabase Admin Client (para uso no backend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[FATAL] Variáveis de ambiente do Supabase (URL e SERVICE_ROLE_KEY) não estão definidas.');
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Servir frontend (dist) em produção
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Endpoint de health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'alive', timestamp: new Date().toISOString() });
});

// Webhook para receber eventos da Evolution API
app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Webhook] Payload recebido:', JSON.stringify(payload).slice(0, 500));

    const instanceName = payload.instance || payload.instance_name;
    const eventType = String(payload.event || '').toLowerCase();

    // Prioriza user_id vindo do header configurado no webhook da Evolution
    let ownerUserId = req.headers['x-user-id'] || payload.user_id;

    // Se não houver user_id, tenta encontrar o dono da instância no banco
    if (!ownerUserId && instanceName) {
      const { data: connOwner, error } = await supabaseAdmin
        .from('connections')
        .select('user_id')
        .eq('instance_name', instanceName)
        .single();
      if (error) console.warn(`[Webhook] Não foi possível encontrar o dono da instância '${instanceName}':`, error.message);
      if (connOwner) ownerUserId = connOwner.user_id;
    }

    if (!ownerUserId) {
      console.error('[Webhook] Erro crítico: não foi possível determinar o user_id para o evento.');
      return res.status(400).json({ error: 'user_id não determinado' });
    }

    // Processamento de novas mensagens
    if (eventType === 'messages.upsert' || Array.isArray(payload.data?.messages)) {
      const messages = payload.data.messages || [];
      for (const msg of messages) {
        const key = msg.key || {};
        if (key.fromMe) continue; // Ignora mensagens enviadas por nós mesmos

        const remoteJid = key.remoteJid || '';
        if (!remoteJid || remoteJid.endsWith('@g.us')) continue; // Ignora grupos

        const phone = remoteJid.split('@')[0];
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const pushName = msg.pushName || phone;

        if (!phone || !messageContent) continue;

        // 1. Garante que o contato exista (Upsert)
        const { data: contact, error: contactError } = await supabaseAdmin
          .from('contacts')
          .upsert({ user_id: ownerUserId, phone_number: phone, name: pushName }, { onConflict: 'user_id, phone_number' })
          .select()
          .single();

        if (contactError) throw new Error(`Erro ao salvar contato: ${contactError.message}`);

        // 2. Garante que a conversa exista (Upsert)
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .upsert({ user_id: ownerUserId, contact_id: contact.id, status: 'pending' }, { onConflict: 'user_id, contact_id' })
          .select()
          .single();
        
        if (convError) throw new Error(`Erro ao salvar conversa: ${convError.message}`);

        // 3. Insere a nova mensagem
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
    console.error('[Webhook] Erro fatal no processamento:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback: retornar index.html para rotas não-API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend (webhook) server running on http://localhost:${PORT}`);
});
