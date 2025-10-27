// SERVIDOR MÍNIMO - SEM SUPABASE - SOLUÇÃO DE EMERGÊNCIA
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS básico
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'Servidor mínimo funcionando!'
  });
});

// Proxy básico para Evolution API
app.all('/api/evolution/*', async (req, res) => {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution.nowhats.com.br';
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
  
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: 'Evolution API não configurada' });
  }

  const targetPath = req.path.replace('/api/evolution', '');
  const targetUrl = `${EVOLUTION_API_URL}${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
        'Authorization': `Bearer ${EVOLUTION_API_KEY}`,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({ error: 'Erro no proxy: ' + error.message });
  }
});

// Servir frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint não encontrado' });
  }
  
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>ChatNegócios</title></head>
        <body>
          <h1>🚀 Sistema ChatNegócios</h1>
          <p>Servidor funcionando! Frontend será carregado em breve...</p>
          <p><a href="/api/health">Testar API</a></p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor mínimo rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});