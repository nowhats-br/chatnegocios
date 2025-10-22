const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();

// CORS dinâmico: permitir origens definidas em CORS_ORIGINS (separadas por vírgula) + localhost dev + domínio de produção
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:5181',
  'http://127.0.0.1:5181',
  'https://evochat.nowhats.com.br',
  'http://evochat.nowhats.com.br',
];
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...envOrigins];

const corsOptions = process.env.CORS_ALLOW_ALL === 'true'
  ? {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Accept', 'Content-Type', 'Authorization', 'apikey', 'X-API-Key'],
    }
  : {
      origin: function (origin, callback) {
        // Permitir requisições sem origem (ex.: curl, serviços internos)
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin);
        callback(null, isAllowed);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Accept', 'Content-Type', 'Authorization', 'apikey', 'X-API-Key'],
    };

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());

// Database setup: try real Postgres, fallback to in-memory
let pool;
const FORCE_PG_MEM = process.env.FORCE_PG_MEM === 'true';
// Minimal schema for app usage (usado em Postgres real e pg-mem)
const schemaSql = `
    create table if not exists profiles (
      id text primary key,
      evolution_api_url text,
      evolution_api_key text
    );

    create table if not exists connections (
      id serial primary key,
      user_id text not null,
      instance_name text not null,
      status text not null,
      created_at timestamp default now(),
      instance_data jsonb
    );

    create table if not exists contacts (
      id serial primary key,
      user_id text not null,
      phone_number text not null,
      name text,
      avatar_url text,
      purchase_history jsonb,
      created_at timestamp default now()
    );

    create table if not exists conversations (
      id text primary key,
      user_id text not null,
      contact_id int references contacts(id),
      connection_id int references connections(id),
      status text,
      created_at timestamp default now(),
      updated_at timestamp default now()
    );

    create table if not exists messages (
      id text primary key,
      conversation_id text references conversations(id),
      sender_is_user boolean not null,
      content text,
      message_type text not null,
      created_at timestamp default now(),
      user_id text not null
    );

    create table if not exists quick_responses (
      id text primary key,
      user_id text not null,
      shortcut text not null,
      message text not null,
      created_at timestamp default now()
    );

    create table if not exists products (
      id text primary key,
      user_id text not null,
      name text not null,
      description text,
      price numeric not null,
      stock int default 0,
      image_url text,
      category text,
      created_at timestamp default now()
    );

    create table if not exists tags (
      id text primary key,
      user_id text not null,
      name text not null,
      color text,
      created_at timestamp default now()
    );

    create table if not exists contact_tags (
      contact_id int references contacts(id),
      tag_id text references tags(id)
    );

    create table if not exists users (
      id text primary key,
      email text unique not null,
      password_hash text not null,
      created_at timestamp default now()
    );

    create table if not exists auth_tokens (
      token text primary key,
      user_id text not null,
      created_at timestamp default now(),
      expires_at timestamp,
      foreign key (user_id) references users(id)
    );
  `;
if (!FORCE_PG_MEM && process.env.DATABASE_URL) {
  console.log('[DB] Using DATABASE_URL (Postgres real)');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  console.log(`[DB] Using pg-mem (in-memory${FORCE_PG_MEM ? ' - forced' : ''})`);
  const db = newDb();
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
  // Garantir schema também no pg-mem
  db.public.none(schemaSql);
}

// Utils
const asyncQuery = async (text, params) => {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
};

// Auth (registro, login e tokens reais)
const crypto = require('crypto');

async function ensureAuthSchema() {
  await asyncQuery('create table if not exists users (id text, email text, password_hash text, created_at text)', []);
  await asyncQuery('create table if not exists auth_tokens (token text, user_id text, created_at text, expires_at text)', []);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const candidate = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

async function issueToken(userId, ttlHours = 24 * 30) { // 30 dias
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  await asyncQuery('insert into auth_tokens (token, user_id, expires_at) values ($1,$2,$3)', [token, userId, expiresAt]);
  return token;
}

function parseAuth(req) {
  const header = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/.exec(header);
  return m ? m[1] : null;
}

async function getUserByToken(token) {
  if (!token) return null;
  const { rows } = await asyncQuery('select u.id, u.email, t.expires_at from auth_tokens t join users u on u.id=t.user_id where t.token=$1', [token]);
  const row = rows && rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await asyncQuery('delete from auth_tokens where token=$1', [token]);
    return null;
  }
  return { id: row.id, email: row.email };
}

app.post('/auth/register', async (req, res) => {
  try {
    await ensureAuthSchema();
    const { email, password } = req.body || {};
    const normEmail = normalizeEmail(email);
    if (!normEmail || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const existing = await asyncQuery('select id from users where email=$1', [normEmail]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Email já cadastrado' });
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const passHash = hashPassword(password);
    await asyncQuery('insert into users (id, email, password_hash) values ($1,$2,$3)', [userId, normEmail, passHash]);
    const token = await issueToken(userId);
    res.json({ token, user: { id: userId, email: normEmail } });
  } catch (e) {
    console.error('[auth/register] error:', e);
    res.status(500).json({ error: (e && e.message) ? e.message : 'Erro interno' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    await ensureAuthSchema();
    const { email, password } = req.body || {};
    const normEmail = normalizeEmail(email);
    if (!normEmail || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const { rows } = await asyncQuery('select id, password_hash from users where email=$1', [normEmail]);
    const row = rows && rows[0];
    if (!row) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = verifyPassword(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = await issueToken(row.id);
    res.json({ token, user: { id: row.id, email: normEmail } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    await ensureAuthSchema();
    const token = parseAuth(req);
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Não autenticado' });
    res.json({ user });
  } catch (e) {
    console.error('[auth/me] error:', e);
    res.status(500).json({ error: (e && e.message) ? e.message : 'Erro interno' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const token = parseAuth(req);
    if (token) await asyncQuery('delete from auth_tokens where token=$1', [token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Profiles
app.get('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await asyncQuery('select evolution_api_url, evolution_api_key from profiles where id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Perfil não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { evolution_api_url, evolution_api_key } = req.body || {};
    await asyncQuery(
      'insert into profiles (id, evolution_api_url, evolution_api_key) values ($1,$2,$3) on conflict (id) do update set evolution_api_url=excluded.evolution_api_url, evolution_api_key=excluded.evolution_api_key',
      [id, evolution_api_url, evolution_api_key]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Connections CRUD
app.get('/connections', async (_req, res) => {
  try {
    const { rows } = await asyncQuery('select * from connections order by created_at desc', []);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await asyncQuery('select * from connections where id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Conexão não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/connections', async (req, res) => {
  try {
    const { user_id, instance_name, status, instance_data } = req.body || {};
    const { rows } = await asyncQuery(
      'insert into connections (user_id, instance_name, status, instance_data) values ($1,$2,$3,$4) returning *',
      [user_id, instance_name, status || 'DISCONNECTED', instance_data || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, instance_data } = req.body || {};
    const { rows } = await asyncQuery(
      'update connections set status=coalesce($1,status), instance_data=coalesce($2,instance_data) where id=$3 returning *',
      [status || null, instance_data || null, id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await asyncQuery('delete from connections where id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Conversations (list with contact)
app.get('/conversations', async (_req, res) => {
  try {
    const { rows } = await asyncQuery(
      'select c.*, json_build_object(\'name\', ct.name, \'avatar_url\', ct.avatar_url, \'phone_number\', ct.phone_number) as contacts from conversations c left join contacts ct on ct.id=c.contact_id order by c.updated_at desc',
      []
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const { rows } = await asyncQuery('update conversations set status=$1, updated_at=now() where id=$2 returning *', [status, id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Messages
app.get('/messages', async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) return res.status(400).json({ error: 'conversationId é obrigatório' });
    const { rows } = await asyncQuery('select * from messages where conversation_id=$1 order by created_at asc', [conversationId]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/messages', async (req, res) => {
  try {
    const { conversation_id, content, sender_is_user, message_type, user_id } = req.body || {};
    const { rows } = await asyncQuery(
      'insert into messages (id, conversation_id, content, sender_is_user, message_type, user_id) values ($1,$2,$3,$4,$5,$6) returning *',
      [String(Date.now()), conversation_id, content || null, !!sender_is_user, message_type, user_id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Quick Responses
app.get('/quick_responses', async (_req, res) => {
  try {
    const { rows } = await asyncQuery('select * from quick_responses order by created_at desc', []);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/quick_responses', async (req, res) => {
  try {
    const { shortcut, message, user_id } = req.body || {};
    if (!shortcut || !message || !user_id) return res.status(400).json({ error: 'Dados inválidos' });
    const id = String(Date.now());
    const { rows } = await asyncQuery(
      'insert into quick_responses (id, user_id, shortcut, message) values ($1,$2,$3,$4) returning *',
      [id, user_id, shortcut, message]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/quick_responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { shortcut, message } = req.body || {};
    const { rows } = await asyncQuery(
      'update quick_responses set shortcut=coalesce($2, shortcut), message=coalesce($3, message) where id=$1 returning *',
      [id, shortcut || null, message || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Mensagem rápida não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/quick_responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await asyncQuery('delete from quick_responses where id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Products
app.get('/products', async (_req, res) => {
  try {
    const { rows } = await asyncQuery('select * from products order by name asc', []);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const { user_id, name, description, price, stock, image_url, category } = req.body || {};
    if (!user_id || !name || price == null || stock == null) return res.status(400).json({ error: 'Dados inválidos' });
    const id = String(Date.now());
    const { rows } = await asyncQuery(
      'insert into products (id, user_id, name, description, price, stock, image_url, category) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *',
      [id, user_id, name, description || null, Number(price), Number(stock), image_url || null, category || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, image_url, category } = req.body || {};
    const { rows } = await asyncQuery(
      'update products set name=coalesce($2, name), description=coalesce($3, description), price=coalesce($4, price), stock=coalesce($5, stock), image_url=coalesce($6, image_url), category=coalesce($7, category) where id=$1 returning *',
      [id, name || null, description || null, price == null ? null : Number(price), stock == null ? null : Number(stock), image_url || null, category || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await asyncQuery('delete from products where id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tags
app.get('/tags', async (_req, res) => {
  try {
    const { rows } = await asyncQuery('select * from tags order by name asc', []);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/tags', async (req, res) => {
  try {
    const { user_id, name, color } = req.body || {};
    if (!user_id || !name) return res.status(400).json({ error: 'Dados inválidos' });
    const id = String(Date.now());
    const { rows } = await asyncQuery(
      'insert into tags (id, user_id, name, color) values ($1,$2,$3,$4) returning *',
      [id, user_id, name, color || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body || {};
    const { rows } = await asyncQuery(
      'update tags set name=coalesce($2,name), color=coalesce($3,color) where id=$1 returning *',
      [id, name || null, color || null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Etiqueta não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await asyncQuery('delete from contact_tags where tag_id=$1', [id]);
    await asyncQuery('delete from tags where id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Contacts (with tags)
app.get('/contacts', async (_req, res) => {
  try {
    const { rows } = await asyncQuery(
      "select c.*, coalesce((select json_agg(json_build_object('contact_id', ct.contact_id, 'tag_id', ct.tag_id, 'tags', row_to_json(t))) from contact_tags ct join tags t on t.id=ct.tag_id where ct.contact_id=c.id),'[]'::json) as contact_tags from contacts c order by c.created_at desc",
      []
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await asyncQuery('delete from contact_tags where contact_id=$1', [id]);
    await asyncQuery('delete from contacts where id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/contacts/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag_ids } = req.body || {};
    if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids deve ser um array de strings' });
    await asyncQuery('delete from contact_tags where contact_id=$1', [id]);
    for (const tagId of tag_ids) {
      await asyncQuery('insert into contact_tags (contact_id, tag_id) values ($1,$2)', [id, tagId]);
    }
    const { rows } = await asyncQuery(
      "select c.*, coalesce((select json_agg(json_build_object('contact_id', ct.contact_id, 'tag_id', ct.tag_id, 'tags', row_to_json(t))) from contact_tags ct join tags t on t.id=ct.tag_id where ct.contact_id=c.id),'[]'::json) as contact_tags from contacts c where c.id=$1",
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Evolution/WhatsApp webhook endpoint
app.get('/api/whatsapp/webhook', async (_req, res) => {
  res.json({ ok: true, status: 'alive' });
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Webhook] Recebido:', JSON.stringify(payload));
    // Aqui você pode integrar com tables/messages/contacts conforme necessário
    // Por agora, apenas confirmamos recebimento
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Inicializa schema e só então inicia o servidor
(async () => {
  try {
    await asyncQuery(schemaSql, []);
    console.log('[DB] Schema garantido (create table if not exists)');
  } catch (e) {
    console.error('[DB] Falha ao garantir schema:', e?.message || e);
  } finally {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  }
})();
// System update check/apply endpoints
app.get('/system/update/check', async (_req, res) => {
  try {
    if (process.env.ENABLE_UI_UPDATE !== 'true') {
      return res.status(403).json({ error: 'Atualização via UI desabilitada' });
    }
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!repo) {
      return res.status(400).json({ error: 'GITHUB_REPO não configurado' });
    }
    // Compatível com Node < 18: usa https nativo ao invés de fetch
    const { URL } = require('url');
    const https = require('https');
    const ghJson = await new Promise((resolve, reject) => {
      const u = new URL(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`);
      const opts = {
        method: 'GET',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'chatnegocios-app'
        }
      };
      const req = https.request(opts, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => {
          const status = resp.statusCode || 0;
          if (status < 200 || status >= 300) {
            return reject(new Error(`HTTP ${status}: ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.end();
    }).catch((err) => {
      return res.status(502).json({ error: `Falha ao consultar GitHub: ${err?.message || String(err)}` });
    });
    const latestSha = ghJson?.sha || '';
    const latestMessage = ghJson?.commit?.message || '';
    const latestDate = ghJson?.commit?.author?.date || '';
    const { exec } = require('child_process');
    const currentSha = await new Promise((resolve) => {
      exec('git rev-parse HEAD', { cwd: process.cwd() }, (err, stdout) => {
        if (err) return resolve('');
        resolve(String(stdout).trim());
      });
    });
    const available = !!latestSha && !!currentSha && latestSha !== currentSha;
    res.json({ available, currentSha, latestSha, latestMessage, latestDate, branch });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/system/update/apply', async (_req, res) => {
  try {
    if (process.env.ENABLE_UI_UPDATE !== 'true') {
      return res.status(403).json({ error: 'Atualização via UI desabilitada' });
    }
    const branch = process.env.GITHUB_BRANCH || 'main';
    const cmds = [
      'git fetch --all',
      `git reset --hard origin/${branch}`,
      'npm install',
      'npm run build'
    ];
    const { exec } = require('child_process');
    for (const cmd of cmds) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          resolve(stdout);
        });
      });
    }
    const autoRestart = process.env.AUTO_RESTART_ON_UPDATE === 'true';
    if (autoRestart) {
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }
    res.json({ ok: true, requiresRestart: !autoRestart });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});