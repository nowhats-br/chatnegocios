const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { newDb } = require('pg-mem');

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();

// CORS dinâmico: permitir origens definidas em CORS_ORIGINS (separadas por vírgula) + localhost dev
const defaultOrigins = ['http://localhost:5173'];
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...envOrigins];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origem (ex.: curl, serviços internos)
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin);
    callback(null, isAllowed);
  },
  credentials: true,
}));
app.use(bodyParser.json());

// Database setup: try real Postgres, fallback to in-memory
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  const db = newDb();
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
  // Minimal schema for app usage
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
  `;
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

// Auth (simple demo)
app.post('/auth/login', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
  const user = { id: 'dev-user', email };
  res.json({ token: 'dev-token', user });
});

app.get('/auth/me', async (_req, res) => {
  // In a real app, validate Authorization header / cookie
  res.json({ user: { id: 'dev-user', email: 'dev@example.com' } });
});

app.post('/auth/logout', async (_req, res) => {
  res.json({ ok: true });
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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
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
    const ghResp = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'chatnegocios-app'
      }
    });
    if (!ghResp.ok) {
      const text = await ghResp.text();
      return res.status(502).json({ error: `Falha ao consultar GitHub: ${text}` });
    }
    const ghJson = await ghResp.json();
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