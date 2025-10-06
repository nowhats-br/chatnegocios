const express = require('express');
const morgan = require('morgan');

const app = express();

const PORT = process.env.WEBHOOK_PORT || 3001;
const PATH = process.env.WEBHOOK_PATH || '/api/evolution/webhook';

app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.post(PATH, (req, res) => {
  console.log(`[Webhook] Evento recebido em ${PATH}:`, {
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ status: 'ok' });
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Webhook server ouvindo em http://127.0.0.1:${PORT}${PATH}`);
});