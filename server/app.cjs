const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Single app server: serves SPA from dist and exposes webhook endpoint
const app = express();

const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3000;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/evolution/webhook';
const DIST_DIR = path.resolve(__dirname, '../dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const DATABASE_URL = process.env.DATABASE_URL;

app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

// Database setup
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL });
} else {
  console.warn('[DB] DATABASE_URL não definido; endpoints de banco ficarão indisponíveis.');
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS connections (
      id SERIAL PRIMARY KEY,
      instance_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      user_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      instance_data JSONB
    );
  `);
}

ensureSchema().catch((err) => {
  console.error('[DB] Falha ao garantir schema:', err);
});

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

// Connections API (PostgreSQL-backed)
app.get('/api/connections', async (_req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  try {
    const { rows } = await pool.query(
      'SELECT id, instance_name, status, user_id, created_at, instance_data FROM connections ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[DB] Erro ao listar conexões:', err);
    res.status(500).json({ message: 'Erro ao listar conexões' });
  }
});

app.post('/api/connections', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const { instance_name, status, user_id, instance_data } = req.body || {};
  if (!instance_name || !status) {
    return res.status(400).json({ message: 'instance_name e status são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO connections (instance_name, status, user_id, instance_data) VALUES ($1, $2, $3, $4) RETURNING id, instance_name, status, user_id, created_at, instance_data',
      [instance_name, status, user_id || null, instance_data || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao inserir conexão:', err);
    const msg = err?.message?.includes('unique') ? 'Nome da instância já existe' : 'Erro ao inserir conexão';
    res.status(500).json({ message: msg });
  }
});

app.patch('/api/connections/:id/status', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!Number.isFinite(id) || !status) {
    return res.status(400).json({ message: 'ID válido e status são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE connections SET status=$1 WHERE id=$2 RETURNING id, instance_name, status, user_id, created_at, instance_data',
      [status, id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Conexão não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao atualizar status:', err);
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

app.delete('/api/connections/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM connections WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ message: 'Conexão não encontrada' });
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error('[DB] Erro ao deletar conexão:', err);
    res.status(500).json({ message: 'Erro ao deletar conexão' });
  }
});

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