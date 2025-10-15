require('dotenv').config();
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
  // Fallback de desenvolvimento: usar banco em memória com pg-mem
  try {
    const { newDb } = require('pg-mem');
    const mem = newDb();
    const { Pool: MemPool } = mem.adapters.createPg();
    pool = new MemPool();
    console.warn('[DB] DATABASE_URL não definido; usando banco em memória (pg-mem) para desenvolvimento.');
  } catch (err) {
    console.warn('[DB] DATABASE_URL não definido e pg-mem não disponível; endpoints de banco ficarão indisponíveis.');
  }
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
  // Fase 1: Quick Responses e Tags
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quick_responses (
      id SERIAL PRIMARY KEY,
      shortcut TEXT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      user_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      user_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      user_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (contact_id, tag_id)
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

// Quick Responses API
app.get('/api/quick-responses', async (_req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  try {
    const { rows } = await pool.query(
      'SELECT id, shortcut, message, user_id, created_at FROM quick_responses ORDER BY shortcut ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[DB] Erro ao listar quick_responses:', err);
    res.status(500).json({ message: 'Erro ao listar quick_responses' });
  }
});

app.post('/api/quick-responses', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const { shortcut, message, user_id } = req.body || {};
  if (!shortcut || !message) {
    return res.status(400).json({ message: 'shortcut e message são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO quick_responses (shortcut, message, user_id) VALUES ($1, $2, $3) RETURNING id, shortcut, message, user_id, created_at',
      [shortcut, message, user_id || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao criar quick_response:', err);
    const msg = err?.message?.includes('unique') ? 'Atalho já existe' : 'Erro ao criar quick_response';
    res.status(500).json({ message: msg });
  }
});

app.patch('/api/quick-responses/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  const { shortcut, message, user_id } = req.body || {};
  if (!Number.isFinite(id) || (!shortcut && !message && typeof user_id === 'undefined')) {
    return res.status(400).json({ message: 'Dados inválidos para atualização' });
  }
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (typeof shortcut !== 'undefined') { fields.push(`shortcut = $${idx++}`); values.push(shortcut); }
    if (typeof message !== 'undefined') { fields.push(`message = $${idx++}`); values.push(message); }
    if (typeof user_id !== 'undefined') { fields.push(`user_id = $${idx++}`); values.push(user_id); }
    values.push(id);
    const sql = `UPDATE quick_responses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, shortcut, message, user_id, created_at`;
    const { rows } = await pool.query(sql, values);
    if (!rows.length) return res.status(404).json({ message: 'Quick response não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao atualizar quick_response:', err);
    res.status(500).json({ message: 'Erro ao atualizar quick_response' });
  }
});

app.delete('/api/quick-responses/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
  try {
    const { rowCount } = await pool.query('DELETE FROM quick_responses WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ message: 'Quick response não encontrada' });
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error('[DB] Erro ao deletar quick_response:', err);
    res.status(500).json({ message: 'Erro ao deletar quick_response' });
  }
});

// Tags API
app.get('/api/tags', async (_req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  try {
    const { rows } = await pool.query(
      'SELECT id::text as id, name, color, user_id, created_at FROM tags ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[DB] Erro ao listar tags:', err);
    res.status(500).json({ message: 'Erro ao listar tags' });
  }
});

app.post('/api/tags', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const { name, color, user_id } = req.body || {};
  if (!name) return res.status(400).json({ message: 'name é obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tags (name, color, user_id) VALUES ($1, $2, $3) RETURNING id::text as id, name, color, user_id, created_at',
      [name, color || null, user_id || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao criar tag:', err);
    const msg = err?.message?.includes('unique') ? 'Nome de etiqueta já existe' : 'Erro ao criar tag';
    res.status(500).json({ message: msg });
  }
});

app.patch('/api/tags/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  const { name, color, user_id } = req.body || {};
  if (!Number.isFinite(id) || (!name && typeof color === 'undefined' && typeof user_id === 'undefined')) {
    return res.status(400).json({ message: 'Dados inválidos para atualização' });
  }
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (typeof name !== 'undefined') { fields.push(`name = $${idx++}`); values.push(name); }
    if (typeof color !== 'undefined') { fields.push(`color = $${idx++}`); values.push(color); }
    if (typeof user_id !== 'undefined') { fields.push(`user_id = $${idx++}`); values.push(user_id); }
    values.push(id);
    const sql = `UPDATE tags SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id::text as id, name, color, user_id, created_at`;
    const { rows } = await pool.query(sql, values);
    if (!rows.length) return res.status(404).json({ message: 'Etiqueta não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[DB] Erro ao atualizar tag:', err);
    res.status(500).json({ message: 'Erro ao atualizar tag' });
  }
});

app.delete('/api/tags/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
  try {
    const { rowCount } = await pool.query('DELETE FROM tags WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ message: 'Etiqueta não encontrada' });
    res.json({ status: 'deleted' });
  } catch (err) {
    console.error('[DB] Erro ao deletar tag:', err);
    res.status(500).json({ message: 'Erro ao deletar tag' });
  }
});

// Client Tags Association API
app.get('/api/clients/:id/tags', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
  try {
    const { rows } = await pool.query(
      `SELECT t.id::text as id, t.name, t.color, t.user_id, t.created_at
       FROM contact_tags ct
       JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_id = $1
       ORDER BY t.name ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[DB] Erro ao listar etiquetas do cliente:', err);
    res.status(500).json({ message: 'Erro ao listar etiquetas do cliente' });
  }
});

app.delete('/api/clients/:id/tags', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
  try {
    const { rowCount } = await pool.query('DELETE FROM contact_tags WHERE contact_id = $1', [id]);
    res.json({ status: 'deleted', count: rowCount });
  } catch (err) {
    console.error('[DB] Erro ao limpar etiquetas do cliente:', err);
    res.status(500).json({ message: 'Erro ao limpar etiquetas do cliente' });
  }
});

app.post('/api/clients/:id/tags', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const id = Number(req.params.id);
  const { tag_ids } = req.body || {};
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
  if (!Array.isArray(tag_ids)) return res.status(400).json({ message: 'tag_ids deve ser um array' });
  const parsedTagIds = tag_ids.map((tid) => Number(tid)).filter((n) => Number.isFinite(n));
  if (parsedTagIds.length !== tag_ids.length) return res.status(400).json({ message: 'tag_ids contém valores inválidos' });
  try {
    // Inserir uma a uma com proteção de conflito
    for (const tid of parsedTagIds) {
      await pool.query(
        'INSERT INTO contact_tags (contact_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, tid]
      );
    }
    // Retornar lista atualizada
    const { rows } = await pool.query(
      `SELECT t.id::text as id, t.name, t.color, t.user_id, t.created_at
       FROM contact_tags ct
       JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_id = $1
       ORDER BY t.name ASC`,
      [id]
    );
    res.status(201).json(rows);
  } catch (err) {
    console.error('[DB] Erro ao adicionar etiquetas ao cliente:', err);
    res.status(500).json({ message: 'Erro ao adicionar etiquetas ao cliente' });
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