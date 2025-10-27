// SERVIDOR SIMPLES SEM PROXY - SOLUÇÃO DEFINITIVA
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const app = express();

// CORS permissivo
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));

// Servir o frontend buildado
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check simples
app.get('/api/health', (req, res) => {
  console.log('[Health] Health check solicitado');
  res.json({ 
    ok: true, 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'Servidor funcionando sem proxy - conexão direta!'
  });
});

// Endpoint para testar se o backend está funcionando
app.get('/api/test-backend', (req, res) => {
  console.log('[Test] Teste do backend solicitado');
  res.json({
    success: true,
    message: 'Backend funcionando perfeitamente!',
    timestamp: new Date().toISOString(),
    note: 'Use conexão direta com a Evolution API no frontend'
  });
});

// Webhook básico (sem Supabase por enquanto)
app.post('/api/whatsapp/webhook', (req, res) => {
  console.log('[Webhook] Webhook recebido:', req.body);
  res.status(200).json({ 
    ok: true, 
    message: 'Webhook recebido com sucesso',
    note: 'Persistência no Supabase será implementada depois'
  });
});

// Rota fallback para servir o index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint não encontrado' });
  }
  
  if (require('fs').existsSync(distPath)) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ChatNegócios</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .status { color: green; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>🚀 ChatNegócios - Sistema Online!</h1>
          <p class="status">✅ Backend funcionando</p>
          <p class="status">✅ Conexão direta com Evolution API habilitada</p>
          <p>Frontend será carregado automaticamente após o build.</p>
          <hr>
          <p><strong>Testes:</strong></p>
          <ul>
            <li><a href="/api/health">Health Check</a></li>
            <li><a href="/api/test-backend">Teste Backend</a></li>
          </ul>
        </body>
      </html>
    `);
  }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[Error] Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor simples rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Teste backend: http://localhost:${PORT}/api/test-backend`);
  console.log(`⚡ Modo: Conexão direta com Evolution API (sem proxy)`);
});