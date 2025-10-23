const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');
const path = require('path');
const { WebSocketServer } = require('ws');

dotenv.config();

// Helper HTTP/HTTPS para Evolution API (compatível com Node < 18)
const http = require('http');
const https = require('https');
function evoRequestJson(baseUrl, path, apiKey, method = 'GET', bodyObj = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
      const isHttps = url.protocol === 'https:';
      const dataStr = bodyObj ? JSON.stringify(bodyObj) : null;
      const options = {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'apikey': apiKey || '',
          'X-API-Key': apiKey || '',
          'Authorization': apiKey ? `Bearer ${apiKey}` : '',
        },
      };
      const req = (isHttps ? https : http).request(url, options, (res) => {
        let chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks).toString('utf-8');
          try {
            const json = JSON.parse(buf);
            resolve(json);
          } catch (e) {
            reject(new Error(`Evolution response not JSON: ${buf.slice(0,200)}`));
          }
        });
      });
      req.on('error', (err) => reject(err));
      if (dataStr) req.write(dataStr);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
 
 const PORT = process.env.PORT || 3001;
 const app = express();
 
 // WebSocket registry e helper de broadcast
const clientsByUser = new Map();
function broadcastToUser(userId, payload) {
  const set = clientsByUser.get(String(userId));
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  set.forEach((ws) => {
    try { ws.send(data); } catch (_e) {}
  });
}

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
  'https://chatvendas.nowhats.com.br',
  'http://chatvendas.nowhats.com.br',
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

// Servir frontend (dist) em produção
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Database setup: try real Postgres, fallback to in-memory
let pool;
let USING_PG_MEM = false;
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
  USING_PG_MEM = true;
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
      'select c.*, ct.name as contact_name, ct.avatar_url as contact_avatar_url, ct.phone_number as contact_phone_number from conversations c left join contacts ct on ct.id=c.contact_id order by c.updated_at desc',
      []
    );
    const formatted = rows.map((r) => {
      const { contact_name, contact_avatar_url, contact_phone_number, ...rest } = r;
      return {
        ...rest,
        contacts: {
          name: contact_name || null,
          avatar_url: contact_avatar_url || null,
          phone_number: contact_phone_number || null,
        },
      };
    });
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const { rows } = await asyncQuery('update conversations set status=$1, updated_at=now() where id=$2 returning *', [status, id]);
    const updated = rows[0];
    // Buscar com contato para manter o formato da lista
    const { rows: convRows } = await asyncQuery(
      "select c.*, ct.name as contact_name, ct.avatar_url as contact_avatar_url, ct.phone_number as contact_phone_number from conversations c left join contacts ct on ct.id=c.contact_id where c.id=$1",
      [id]
    );
    let conv = convRows[0] || updated;
    if (conv) {
      const { contact_name, contact_avatar_url, contact_phone_number, ...rest } = conv;
      conv = {
        ...rest,
        contacts: {
          name: contact_name || null,
          avatar_url: contact_avatar_url || null,
          phone_number: contact_phone_number || null,
        },
      };
    }
    // Notificar somente o dono da conversa
    if (updated && updated.user_id) {
      broadcastToUser(updated.user_id, { type: 'conversation_upsert', conversation: conv });
    }
    res.json(updated);
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
    const id = String(Date.now());
    const { rows } = await asyncQuery(
      'insert into messages (id, conversation_id, content, sender_is_user, message_type, user_id) values ($1,$2,$3,$4,$5,$6) returning *',
      [id, conversation_id, content || null, !!sender_is_user, message_type, user_id]
    );
    const created = rows[0];
    // Atualiza updated_at da conversa
    await asyncQuery('update conversations set updated_at=now() where id=$1', [conversation_id]);
    // Broadcast da nova mensagem e conversa atualizada
    if (created && created.user_id) {
      broadcastToUser(created.user_id, { type: 'message_new', message: created });
      const { rows: convRows } = await asyncQuery(
        "select c.*, ct.name as contact_name, ct.avatar_url as contact_avatar_url, ct.phone_number as contact_phone_number from conversations c left join contacts ct on ct.id=c.contact_id where c.id=$1",
        [conversation_id]
      );
      let conv = convRows[0];
      if (conv) {
        const { contact_name, contact_avatar_url, contact_phone_number, ...rest } = conv;
        conv = {
          ...rest,
          contacts: {
            name: contact_name || null,
            avatar_url: contact_avatar_url || null,
            phone_number: contact_phone_number || null,
          },
        };
        broadcastToUser(created.user_id, { type: 'conversation_upsert', conversation: conv });
      }
    }
    res.json(created);
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

// Conversations (with tags)
app.get('/contacts', async (_req, res) => {
  try {
    const { rows } = await asyncQuery(
      "select c.*, ct.tag_id as tag_id, t.id as t_id, t.user_id as t_user_id, t.name as t_name, t.color as t_color, t.created_at as t_created_at from contacts c left join contact_tags ct on ct.contact_id=c.id left join tags t on t.id=ct.tag_id order by c.created_at desc",
      []
    );
    const contacts = [];
    const byId = new Map();
    for (const r of rows) {
      const { tag_id, t_id, t_user_id, t_name, t_color, t_created_at, ...base } = r;
      let obj = byId.get(base.id);
      if (!obj) {
        obj = { ...base, contact_tags: [] };
        byId.set(base.id, obj);
        contacts.push(obj);
      }
      if (tag_id && t_id) {
        obj.contact_tags.push({
          contact_id: base.id,
          tag_id: tag_id,
          tags: {
            id: t_id,
            user_id: t_user_id,
            name: t_name,
            color: t_color,
            created_at: t_created_at,
          },
        });
      }
    }
    res.json(contacts);
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
      "select c.*, ct.tag_id as tag_id, t.id as t_id, t.user_id as t_user_id, t.name as t_name, t.color as t_color, t.created_at as t_created_at from contacts c left join contact_tags ct on ct.contact_id=c.id left join tags t on t.id=ct.tag_id where c.id=$1",
      [id]
    );
    const grouped = new Map();
    for (const r of rows) {
      const { tag_id, t_id, t_user_id, t_name, t_color, t_created_at, ...base } = r;
      let obj = grouped.get(base.id);
      if (!obj) {
        obj = { ...base, contact_tags: [] };
        grouped.set(base.id, obj);
      }
      if (tag_id && t_id) {
        obj.contact_tags.push({
          contact_id: base.id,
          tag_id: tag_id,
          tags: {
            id: t_id,
            user_id: t_user_id,
            name: t_name,
            color: t_color,
            created_at: t_created_at,
          },
        });
      }
    }
    const result = grouped.size ? Array.from(grouped.values())[0] : rows[0];
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Evolution/WhatsApp webhook endpoint
app.get('/api/whatsapp/webhook', async (_req, res) => {
  res.json({ ok: true, status: 'alive' });
});

// Sincronizar últimas conversas da Evolution (após conexão QR)
app.post('/api/evolution/syncChats', async (req, res) => {
  try {
    const { connection_id, instance_name, limit } = req.body || {};
    const targetLimit = Number(limit) > 0 && Number(limit) <= 50 ? Number(limit) : 10;

    // Resolver conexão e proprietário
    let instanceName = String(instance_name || '').trim();
    let ownerUserId = null;
    let connectionId = null;
    if (!instanceName && connection_id != null) {
      const { rows } = await asyncQuery('select id, user_id, instance_name from connections where id=$1', [connection_id]);
      const row = rows && rows[0];
      if (!row) return res.status(404).json({ error: 'Conexão não encontrada' });
      instanceName = String(row.instance_name);
      ownerUserId = String(row.user_id);
      connectionId = row.id;
    } else if (instanceName) {
      const { rows } = await asyncQuery('select id, user_id from connections where instance_name=$1 limit 1', [instanceName]);
      const row = rows && rows[0];
      if (row) {
        ownerUserId = String(row.user_id);
        connectionId = row.id;
      }
    }
    if (!instanceName) return res.status(400).json({ error: 'instance_name é obrigatório (ou forneça connection_id)' });

    // Evolução: obter URL e API key do perfil, com fallback para env
    async function resolveEvolutionSettings(userId) {
      let baseUrl = process.env.EVOLUTION_API_URL || null;
      let apiKey = process.env.EVOLUTION_API_KEY || null;
      if (userId) {
        try {
          const { rows } = await asyncQuery('select evolution_api_url, evolution_api_key from profiles where id=$1', [String(userId)]);
          if (rows && rows[0]) {
            baseUrl = rows[0].evolution_api_url || baseUrl;
            apiKey = rows[0].evolution_api_key || apiKey;
          }
        } catch (_) {}
      }
      return { baseUrl, apiKey };
    }
    const { baseUrl, apiKey } = await resolveEvolutionSettings(ownerUserId);
    if (!baseUrl || !apiKey) return res.status(400).json({ error: 'Evolution API não configurada (url/apikey)' });

    // Buscar conversas via Evolution
    let evoChatsResp;
    try {
      evoChatsResp = await evoRequestJson(baseUrl, `/chat/findChats/${instanceName}`, apiKey, 'GET');
    } catch (e) {
      // Fallbacks possíveis
      try {
        evoChatsResp = await evoRequestJson(baseUrl, `/chat/findChats?instance=${encodeURIComponent(instanceName)}`, apiKey, 'GET');
      } catch (e2) {
        return res.status(502).json({ error: `Falha ao consultar Evolution: ${e2?.message || String(e2)}` });
      }
    }
    const chats = (Array.isArray(evoChatsResp?.data) ? evoChatsResp.data : (Array.isArray(evoChatsResp?.chats) ? evoChatsResp.chats : (Array.isArray(evoChatsResp) ? evoChatsResp : []))) || [];
    const sliced = chats.slice(0, targetLimit);

    function extractPhoneFromJid(remoteJid) {
      if (!remoteJid || typeof remoteJid !== 'string') return null;
      // ignora grupos e broadcasts
      if (remoteJid.includes('@g.us') || remoteJid.includes('broadcast')) return null;
      const match = remoteJid.match(/\d+/g);
      const digits = match ? match.join('') : '';
      return digits || null;
    }

    const createdOrUpdated = [];
    for (const c of sliced) {
      const remoteJid = c?.remoteJid || c?.id || c?.jid || c?.chatId || (c?.key ? c.key.remoteJid : null) || (c?.id && c.id._serialized ? c.id._serialized : null);
      const phone = extractPhoneFromJid(String(remoteJid || ''));
      if (!phone) continue;

      // Garantir contato
      let contactId;
      {
        const { rows } = await asyncQuery('select id from contacts where user_id=$1 and phone_number=$2', [ownerUserId || (process.env.DEFAULT_USER_ID || 'system'), phone]);
        if (rows[0]) {
          contactId = rows[0].id;
        } else {
          const displayName = c?.name || c?.formattedTitle || c?.pushName || null;
          const { rows: inserted } = await asyncQuery(
            'insert into contacts (user_id, phone_number, name, avatar_url) values ($1,$2,$3,$4) returning id',
            [ownerUserId || (process.env.DEFAULT_USER_ID || 'system'), phone, displayName, null]
          );
          contactId = inserted[0].id;
        }
      }

      // Conversa: obter ou criar e atualizar updated_at
      let conversationId;
      {
        const { rows } = await asyncQuery(
          'select id, status, user_id from conversations where user_id=$1 and contact_id=$2 order by created_at desc limit 1',
          [ownerUserId || (process.env.DEFAULT_USER_ID || 'system'), contactId]
        );
        const existing = rows[0];
        if (!existing) {
          conversationId = `conv_${Date.now()}_${Math.floor(Math.random()*1000)}`;
          await asyncQuery(
            'insert into conversations (id, user_id, contact_id, connection_id, status) values ($1,$2,$3,$4,$5)',
            [conversationId, ownerUserId || (process.env.DEFAULT_USER_ID || 'system'), contactId, connectionId || null, 'pending']
          );
        } else {
          conversationId = existing.id;
          await asyncQuery('update conversations set updated_at=now() where id=$1', [conversationId]);
        }
      }

      // Se disponível, registrar última mensagem como histórico inicial
      try {
        const lastText = c?.lastMessage?.message?.conversation || c?.lastText || c?.text || null;
        if (lastText) {
          const messageId = `msg_${Date.now()}_${Math.floor(Math.random()*1000)}`;
          await asyncQuery(
            'insert into messages (id, conversation_id, sender_is_user, content, message_type, user_id) values ($1,$2,$3,$4,$5,$6)',
            [messageId, conversationId, false, String(lastText), 'text', ownerUserId || (process.env.DEFAULT_USER_ID || 'system')]
          );
        }
      } catch (_) {}

      // Buscar conversa com contato para broadcast
      const { rows: convRows } = await asyncQuery(
        "select c.*, ct.name as contact_name, ct.avatar_url as contact_avatar_url, ct.phone_number as contact_phone_number from conversations c left join contacts ct on ct.id=c.contact_id where c.id=$1",
        [conversationId]
      );
      let conv = convRows[0];
      if (conv) {
        const { contact_name, contact_avatar_url, contact_phone_number, ...rest } = conv;
        conv = {
          ...rest,
          contacts: {
            name: contact_name || null,
            avatar_url: contact_avatar_url || null,
            phone_number: contact_phone_number || null,
          },
        };
        broadcastToUser(ownerUserId || (process.env.DEFAULT_USER_ID || 'system'), { type: 'conversation_upsert', conversation: conv });
      }
      createdOrUpdated.push({ conversation_id: conversationId, phone });
    }

    res.json({ ok: true, count: createdOrUpdated.length, items: createdOrUpdated });
  } catch (e) {
    console.error('[syncChats] erro:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[Webhook] Recebido:', JSON.stringify(payload));

    const instanceName = payload.instance_name || payload.instance || null;
    let ownerUserId = String(payload.user_id || req.headers['x-user-id'] || process.env.DEFAULT_USER_ID || 'system');
    // Se a instância estiver associada a uma conexão, usar o dono dessa conexão
    if (instanceName) {
      try {
        const { rows: connOwnerRows } = await asyncQuery('select user_id from connections where instance_name=$1 limit 1', [instanceName]);
        if (connOwnerRows && connOwnerRows[0]?.user_id) {
          ownerUserId = String(connOwnerRows[0].user_id);
        }
      } catch (_e) {
        // manter ownerUserId pelo fallback
      }
    }
    const phone = String(payload.from || payload.phone || '').replace(/\D/g, '');
    const content = String(payload.message || payload.text || '');
    const messageType = payload.type === 'image' ? 'image' : (payload.type === 'file' ? 'file' : 'text');

    if (!phone || !content) {
      return res.status(400).json({ error: 'Payload inválido: requer phone/from e message/text' });
    }

    // Garantir contato
    let contactId;
    {
      const { rows } = await asyncQuery('select id from contacts where user_id=$1 and phone_number=$2', [ownerUserId, phone]);
      if (rows[0]) {
        contactId = rows[0].id;
      } else {
        const { rows: inserted } = await asyncQuery(
          'insert into contacts (user_id, phone_number, name, avatar_url) values ($1,$2,$3,$4) returning id',
          [ownerUserId, phone, payload.name || null, payload.avatar_url || null]
        );
        contactId = inserted[0].id;
      }
    }

    // Obter conexão
    let connectionId = null;
    if (instanceName) {
      const { rows } = await asyncQuery('select id from connections where instance_name=$1', [instanceName]);
      connectionId = rows[0]?.id || null;
    }

    // Conversa: obter ou criar (pendente)
    let conversationId;
    {
      const { rows } = await asyncQuery(
        'select id, status from conversations where user_id=$1 and contact_id=$2 order by created_at desc limit 1',
        [ownerUserId, contactId]
      );
      const existing = rows[0];
      if (!existing || (existing.status && existing.status.toLowerCase() === 'resolved')) {
        conversationId = `conv_${Date.now()}`;
        await asyncQuery(
          'insert into conversations (id, user_id, contact_id, connection_id, status) values ($1,$2,$3,$4,$5)',
          [conversationId, ownerUserId, contactId, connectionId, 'pending']
        );
      } else {
        conversationId = existing.id;
        const newStatus = existing.status && existing.status.toLowerCase() !== 'active' ? 'pending' : existing.status;
        await asyncQuery('update conversations set status=$2, updated_at=now() where id=$1', [conversationId, newStatus]);
      }
    }

    // Registrar mensagem
    const messageId = `msg_${Date.now()}`;
    await asyncQuery(
      'insert into messages (id, conversation_id, sender_is_user, content, message_type, user_id) values ($1,$2,$3,$4,$5,$6)',
      [messageId, conversationId, false, content, messageType, ownerUserId]
    );

    // Buscar conversa com contato para broadcast (webhook)
    const { rows: convRows } = await asyncQuery(
      "select c.*, ct.name as contact_name, ct.avatar_url as contact_avatar_url, ct.phone_number as contact_phone_number from conversations c left join contacts ct on ct.id=c.contact_id where c.id=$1",
      [conversationId]
    );
    let conversationWithContact = convRows[0];
    if (conversationWithContact) {
      const { contact_name, contact_avatar_url, contact_phone_number, ...rest } = conversationWithContact;
      conversationWithContact = {
        ...rest,
        contacts: {
          name: contact_name || null,
          avatar_url: contact_avatar_url || null,
          phone_number: contact_phone_number || null,
        },
      };
    }

    // Buscar mensagem para broadcast
    const { rows: msgRows } = await asyncQuery('select * from messages where id=$1', [messageId]);
    const messageRow = msgRows[0];

    // Emitir eventos em tempo real
    broadcastToUser(ownerUserId, { type: 'conversation_upsert', conversation: conversationWithContact });
    broadcastToUser(ownerUserId, { type: 'message_new', message: messageRow });

    res.json({ ok: true, conversation_id: conversationId, contact_id: contactId, message_id: messageId });
  } catch (e) {
    console.error('[Webhook] erro:', e);
    res.status(500).json({ error: e.message });
  }
});

// Inicializa schema e só então inicia o servidor
(async () => {
  try {
    if (!USING_PG_MEM) {
      await asyncQuery(schemaSql, []);
      console.log('[DB] Schema garantido (create table if not exists)');
    } else {
      console.log('[DB] Schema já aplicado via pg-mem');
    }
  } catch (e) {
    console.error('[DB] Falha ao garantir schema:', e?.message || e);
  } finally {
    // SPA fallback: retornar index.html para rotas não-API
    const apiPrefixes = ['/auth','/profiles','/connections','/messages','/conversations','/system','/tags','/products','/contacts'];
    app.get('*', (req, res, next) => {
      if (apiPrefixes.some((p) => req.path.startsWith(p))) return next();
      res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });

    const server = app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });

    // Anexar WebSocket server
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const userId = url.searchParams.get('user_id') || 'system';
        let set = clientsByUser.get(userId);
        if (!set) { set = new Set(); clientsByUser.set(userId, set); }
        set.add(ws);
        ws.on('close', () => {
          const s = clientsByUser.get(userId);
          if (s) {
            s.delete(ws);
            if (s.size === 0) clientsByUser.delete(userId);
          }
        });
      } catch (err) {
        console.error('[WS] erro de conexão:', err?.message || err);
      }
    });
    console.log('[WS] WebSocket ativo em /ws');
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