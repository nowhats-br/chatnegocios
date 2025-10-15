require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
app.use(cors());

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
  // Users auth (local)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
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
  // Evolution API settings por usuário
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_settings (
      user_id TEXT PRIMARY KEY,
      evolution_api_url TEXT,
      evolution_api_key TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

ensureSchema().catch((err) => {
  console.error('[DB] Falha ao garantir schema:', err);
});

// Password hashing helpers (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 120000; // OWASP recommended range
  const keylen = 64;
  const digest = 'sha512';
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return `${salt}:${iterations}:${digest}:${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, iterStr, digest, derived] = stored.split(':');
    const iterations = parseInt(iterStr, 10);
    const keylen = Buffer.from(derived, 'hex').length;
    const check = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'));
  } catch (_) {
    return false;
  }
}

// Seed admin from environment
async function ensureAdminSeed() {
  if (!pool) return;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminRole = process.env.ADMIN_ROLE || 'admin';
  if (!adminEmail || !adminPassword) return;
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      const password_hash = hashPassword(adminPassword);
      const ins = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
        [adminEmail, password_hash, adminRole]
      );
      console.log(`[Auth] Usuário admin criado: ${ins.rows[0].email}`);
    } else {
      console.log('[Auth] Usuário admin já existe, não será recriado.');
    }
  } catch (err) {
    console.error('[Auth] Falha ao criar admin:', err);
  }
}

ensureAdminSeed();

// Webhook endpoint
app.post(WEBHOOK_PATH, (req, res) => {
  console.log(`[Webhook] Evento recebido em ${WEBHOOK_PATH}:`, {
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ status: 'ok' });
});

// -----------------------------
// Mock Evolution API (dev only)
// -----------------------------
// These endpoints simulate Evolution API responses for local testing.
// Point VITE_EVOLUTION_API_URL to "http://localhost:3000/mock-evo" in development.

app.post('/mock-evo/instance/create', (req, res) => {
  const body = req.body || {};
  const instanceName = body.instanceName || 'instance_dev';
  return res.status(201).json({
    instance: {
      instanceName,
      status: 'DISCONNECTED',
    },
    hash: { apikey: 'mocked-api-key-123' },
    webhook: {
      url: body.webhook?.url || '',
      enabled: !!body.webhook?.enabled,
    },
  });
});

app.get('/mock-evo/instance/connect/:instance', (req, res) => {
  const { instance } = req.params;
  return res.json({
    instance: { instanceName: instance, status: 'CONNECTING' },
    message: 'Mock connect initialized',
  });
});

app.get('/mock-evo/instance/qrCode/:instance', (req, res) => {
  const { instance } = req.params;
  // Provide a pairing code for simpler local testing.
  const pairingCode = `${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}`;
  return res.json({
    instance: { instanceName: instance, status: 'CONNECTING' },
    pairingCode,
    count: Math.floor(Math.random() * 3) + 1,
  });
});

app.get('/mock-evo/instance/fetchInstances/:instance', (req, res) => {
  const { instance } = req.params;
  return res.json({
    instance: { instanceName: instance, status: 'DISCONNECTED' },
    connectionStatus: { state: 'close' },
  });
});

app.delete('/mock-evo/instance/delete/:instance', (req, res) => {
  const { instance } = req.params;
  return res.json({ status: 'SUCCESS', message: `Instance ${instance} deleted (mock)` });
});

// Healthcheck
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// Auth API (local)
app.post('/api/auth/signup', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email e password são obrigatórios' });
  if (String(password).length < 6) return res.status(400).json({ message: 'senha deve ter ao menos 6 caracteres' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ message: 'E-mail já cadastrado' });
    const password_hash = hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [email, password_hash, 'user']
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('[Auth] Erro no signup:', err);
    res.status(500).json({ message: 'Erro ao cadastrar usuário' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email e password são obrigatórios' });
  try {
    const { rows } = await pool.query('SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Credenciais inválidas' });
    const userRow = rows[0];
    const ok = verifyPassword(String(password), String(userRow.password_hash));
    if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });
    const { id, email: userEmail, role, created_at } = userRow;
    res.json({ user: { id, email: userEmail, role, created_at } });
  } catch (err) {
    console.error('[Auth] Erro no login:', err);
    res.status(500).json({ message: 'Erro ao efetuar login' });
  }
});

// API Settings (Evolution) - persistência por usuário
app.get('/api/settings/:userId', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ message: 'userId é obrigatório' });
  try {
    const { rows } = await pool.query(
      'SELECT evolution_api_url, evolution_api_key, updated_at FROM api_settings WHERE user_id = $1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Configuração não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[Settings] Erro ao buscar configurações:', err);
    res.status(500).json({ message: 'Erro ao buscar configurações' });
  }
});

app.put('/api/settings/:userId', async (req, res) => {
  if (!pool) return res.status(503).json({ message: 'Banco não configurado' });
  const userId = String(req.params.userId || '').trim();
  const { evolution_api_url, evolution_api_key } = req.body || {};
  if (!userId) return res.status(400).json({ message: 'userId é obrigatório' });
  if (!evolution_api_url || !evolution_api_key) {
    return res.status(400).json({ message: 'evolution_api_url e evolution_api_key são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO api_settings (user_id, evolution_api_url, evolution_api_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET evolution_api_url = EXCLUDED.evolution_api_url,
                     evolution_api_key = EXCLUDED.evolution_api_key,
                     updated_at = NOW()
       RETURNING user_id, evolution_api_url, evolution_api_key, updated_at`,
      [userId, evolution_api_url, evolution_api_key]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[Settings] Erro ao salvar configurações:', err);
    res.status(500).json({ message: 'Erro ao salvar configurações' });
  }
});

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