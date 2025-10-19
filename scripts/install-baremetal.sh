#!/usr/bin/env bash
set -euo pipefail

# ChatNegócios — Instalador bare-metal (Ubuntu/Debian)
# Instala Node, Nginx, PostgreSQL; configura portas sem conflito; builda frontend; cria service do backend.
# Uso: sudo bash scripts/install-baremetal.sh [--domain seu-dominio] [--app-dir /opt/chatnegocios] [--webroot /var/www/chatnegocios/frontend]
#      [--db-user chat_user] [--db-pass chat_pass] [--db-name chatnegocios] [--db-port 5433] [--backend-port 3201] [--nginx-port 8080]

if [ "${EUID}" -ne 0 ]; then
  echo "[ERRO] Execute como root: sudo bash scripts/install-baremetal.sh"; exit 1
fi

DOMAIN=""
APP_DIR="$(pwd)"
WEBROOT="/var/www/chatnegocios/frontend"
DB_USER="chat_user"
DB_PASS="chat_pass"
DB_NAME="chatnegocios"
DB_PORT="5433"
BACKEND_PORT="3201"
NGINX_PORT="8080"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --app-dir) APP_DIR="$2"; shift 2;;
    --webroot) WEBROOT="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;;
    --db-pass) DB_PASS="$2"; shift 2;;
    --db-name) DB_NAME="$2"; shift 2;;
    --db-port) DB_PORT="$2"; shift 2;;
    --backend-port) BACKEND_PORT="$2"; shift 2;;
    --nginx-port) NGINX_PORT="$2"; shift 2;;
    *) echo "Argumento desconhecido: $1"; exit 1;;
  esac
done

echo "[1/7] Instalando pacotes (curl, gnupg, lsb-release, nginx, postgresql, node)"
apt-get update -y
apt-get install -y curl gnupg lsb-release
if ! command -v nginx >/dev/null 2>&1; then apt-get install -y nginx; fi
if ! command -v psql >/dev/null 2>&1; then apt-get install -y postgresql; fi
if ! command -v node >/dev/null 2>&1; then 
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi

echo "[2/7] Configurando PostgreSQL na porta ${DB_PORT} e criando banco/usuário"
PGCONF=$(find /etc/postgresql -maxdepth 2 -name postgresql.conf | head -n1 || true)
if [ -n "$PGCONF" ]; then
  sed -i "s/^#*port.*/port = ${DB_PORT}/" "$PGCONF" || true
  systemctl restart postgresql || true
fi
# Cria usuário se não existir
EXISTS_USER=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || true)
if [ "$EXISTS_USER" != "1" ]; then sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"; fi
# Cria DB se não existir
EXISTS_DB=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || true)
if [ "$EXISTS_DB" != "1" ]; then sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"; fi

# Aplica schema mínimo
sudo -u postgres psql -d "${DB_NAME}" <<SQL
create table if not exists profiles (id text primary key, evolution_api_url text, evolution_api_key text);
create table if not exists connections (id serial primary key, user_id text not null, instance_name text not null, status text not null, created_at timestamp default now(), instance_data jsonb);
create table if not exists contacts (id serial primary key, user_id text not null, phone_number text not null, name text, avatar_url text, purchase_history jsonb, created_at timestamp default now());
create table if not exists conversations (id text primary key, user_id text not null, contact_id int references contacts(id), connection_id int references connections(id), status text, created_at timestamp default now(), updated_at timestamp default now());
create table if not exists messages (id text primary key, conversation_id text references conversations(id), sender_is_user boolean not null, content text, message_type text not null, created_at timestamp default now(), user_id text not null);
create table if not exists quick_responses (id text primary key, user_id text not null, shortcut text not null, message text not null, created_at timestamp default now());
create table if not exists products (id text primary key, user_id text not null, name text not null, description text, price numeric not null, stock int default 0, image_url text, category text, created_at timestamp default now());
create table if not exists tags (id text primary key, user_id text not null, name text not null, color text, created_at timestamp default now());
create table if not exists contact_tags (contact_id int references contacts(id), tag_id text references tags(id));
SQL

echo "[3/7] Preparando .env e build do frontend"
mkdir -p "$APP_DIR"
ENV_FILE="$APP_DIR/.env"
ORIGIN="http://${DOMAIN:-localhost}:${NGINX_PORT}"
cat > "$ENV_FILE" <<EOF
PORT=${BACKEND_PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}
CORS_ORIGINS=${ORIGIN}
VITE_BACKEND_URL=${ORIGIN}/api
VITE_EVOLUTION_API_URL=
VITE_EVOLUTION_API_KEY=
EOF
cd "$APP_DIR"
if [ -f package.json ]; then npm ci; npm run build; else echo "[AVISO] package.json não encontrado em ${APP_DIR}"; fi
mkdir -p "$WEBROOT"
if [ -d "$APP_DIR/dist" ]; then cp -r "$APP_DIR/dist/"* "$WEBROOT/"; fi

echo "[4/7] Criando serviço systemd do backend"
UNIT="/etc/systemd/system/chatnegocios.service"
cat > "$UNIT" <<EOF
[Unit]
Description=ChatNegocios Backend
After=network.target
[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node server/app.cjs
Restart=on-failure
EnvironmentFile=-${ENV_FILE}
User=$(id -un)
Group=$(id -gn)
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now chatnegocios

echo "[5/7] Configurando Nginx na porta ${NGINX_PORT}"
NGCONF="/etc/nginx/sites-available/chatnegocios.conf"
cat > "$NGCONF" <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
    listen ${NGINX_PORT};
    server_name _;
    root ${WEBROOT};
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout 60s;
    }
    gzip on; gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; gzip_min_length 1024;
}
EOF
ln -sf "$NGCONF" /etc/nginx/sites-enabled/chatnegocios.conf
nginx -t
systemctl restart nginx

echo "[6/7] Verificando serviços"
systemctl --no-pager status chatnegocios || true
systemctl --no-pager status nginx || true

echo "[7/7] Concluído"
echo "Acesse: ${ORIGIN}"
echo "Proxy API: ${ORIGIN}/api (ex.: curl ${ORIGIN}/api/auth/me)"
echo "Postgres: 127.0.0.1:${DB_PORT} DB=${DB_NAME} USER=${DB_USER}"