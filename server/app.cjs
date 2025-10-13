const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Single app server: serves SPA from dist and exposes webhook endpoint
const app = express();

const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/evolution/webhook';
const DIST_DIR = path.resolve(__dirname, '../dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

// Webhook endpoint
app.post(WEBHOOK_PATH, (req, res) => {
  console.log(`[Webhook] Evento recebido em ${WEBHOOK_PATH}:`, {
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ status: 'ok' });
});

// Healthcheck
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// Serve SPA static files
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// SPA fallback to index.html
app.get('*', (req, res, next) => {
  if (!fs.existsSync(INDEX_HTML)) return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`App ouvindo em http://0.0.0.0:${PORT}`);
  console.log(`Webhook em http://0.0.0.0:${PORT}${WEBHOOK_PATH}`);
  console.log(`Static dir: ${DIST_DIR}`);
});