#!/usr/bin/env bash
set -euo pipefail

# ChatNegócios — Instalador bare-metal (Ubuntu/Debian)
# Node 20+, Nginx, PostgreSQL, Backend/Frontend, Evolution API (URL/Key/Webhook),
# SSL opcional, criar instância Evolution e QR opcional.
# Uso:
# sudo bash scripts/install-baremetal.sh --domain seu-dominio \
#   [--enable-ssl --email admin@dominio] \
#   [--app-dir /opt/chatnegocios] [--webroot /var/www/chatnegocios/frontend] \
#   [--db-user chat_user] [--db-pass chat_pass] [--db-name chatnegocios] [--db-port 5433] \
#   [--backend-port 3201] [--nginx-port 8080] \
#   [--evo-url https://evolution.example.com] [--evo-key API_KEY] [--evo-instance minha_instancia]

if [ "${EUID}" -ne 0 ]; then echo "[ERRO] Execute como root (sudo)."; exit 1; fi

FRONTEND_DOMAIN=""; BACKEND_DOMAIN=""; ENABLE_SSL="false"; EMAIL=""; APP_DIR="$(pwd)"; WEBROOT="/var/www/chatnegocios/frontend"
DB_USER="chat_user"; DB_PASS="chat_pass"; DB_NAME="chatnegocios"; DB_PORT="5433"
BACKEND_PORT="3201"; NGINX_PORT="8080"; EVOLUTION_API_URL=""; EVOLUTION_API_KEY=""; EVO_INSTANCE=""
ACME_MODE="http"; CF_API_TOKEN=""
REINSTALL_NGINX="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) FRONTEND_DOMAIN="$2"; BACKEND_DOMAIN="$2"; shift 2;;
    --frontend-domain) FRONTEND_DOMAIN="$2"; shift 2;;
    --backend-domain) BACKEND_DOMAIN="$2"; shift 2;;
    --enable-ssl) ENABLE_SSL="true"; shift 1;; --email) EMAIL="$2"; shift 2;;
    --app-dir) APP_DIR="$2"; shift 2;; --webroot) WEBROOT="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;; --db-pass) DB_PASS="$2"; shift 2;; --db-name) DB_NAME="$2"; shift 2;; --db-port) DB_PORT="$2"; shift 2;;
    --backend-port) BACKEND_PORT="$2"; shift 2;; --nginx-port) NGINX_PORT="$2"; shift 2;;
    --dns-cloudflare-token) CF_API_TOKEN="$2"; shift 2;;
    --reinstall-nginx) REINSTALL_NGINX="true"; shift 1;;
    --evo-url) EVOLUTION_API_URL="$2"; shift 2;; --evo-key) EVOLUTION_API_KEY="$2"; shift 2;; --evo-instance) EVO_INSTANCE="$2"; shift 2;;
    *) echo "Argumento desconhecido: $1"; exit 1;;
  esac
done

# Prompts interativos se não fornecidos por argumentos
if [ -z "$FRONTEND_DOMAIN" ]; then read -rp "Domínio do frontend (ex.: app.seudominio.com): " FRONTEND_DOMAIN; fi
if [ -z "$BACKEND_DOMAIN" ]; then read -rp "Domínio do backend/API (ex.: api.seudominio.com): " BACKEND_DOMAIN; fi
if [ "$ENABLE_SSL" != "true" ]; then read -rp "Habilitar SSL (Let's Encrypt)? [s/N]: " ANSW; ANSW=$(echo "${ANSW:-N}" | tr '[:upper:]' '[:lower:]'); { [ "$ANSW" = "s" ] || [ "$ANSW" = "y" ]; } && ENABLE_SSL="true"; fi
if [ "$ENABLE_SSL" = "true" ] && [ -z "$EMAIL" ]; then read -rp "E-mail para Certbot (Let's Encrypt): " EMAIL; fi

echo "[1/9] Pacotes"; apt-get update -y || true; apt-get install -y curl gnupg lsb-release jq nginx postgresql || true
if [ "$REINSTALL_NGINX" = "true" ]; then
  echo "[1/9] Reinstalando Nginx (purge + install)"; systemctl stop nginx || true
  apt-get remove --purge -y nginx nginx-common nginx-full || true
  apt-get install -y nginx || true
fi

echo "[2/9] Node 20+"; CURRENT_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)
if [ "$CURRENT_MAJOR" -lt 20 ]; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs || true; fi
command -v npm >/dev/null 2>&1 || apt-get install -y npm || true

echo "[3/9] Postgres"; PGCONF=$(find /etc/postgresql -maxdepth 2 -name postgresql.conf | head -n1 || true)
[ -n "$PGCONF" ] && sed -i "s/^#*port.*/port = ${DB_PORT}/" "$PGCONF" || true; systemctl restart postgresql || true
EXISTS_USER=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" || true)
[ "$EXISTS_USER" = "1" ] || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" || true
EXISTS_DB=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" || true)
[ "$EXISTS_DB" = "1" ] || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" || true
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

echo "[4/9] .env + build"; mkdir -p "$APP_DIR"
# Origens separadas para frontend e backend (inclui porta customizada se não for 443)
if [ "$ENABLE_SSL" = "true" ]; then
  if [ -n "$FRONTEND_DOMAIN" ]; then
    if [ "$NGINX_PORT" = "443" ]; then FRONTEND_ORIGIN="https://${FRONTEND_DOMAIN}"; else FRONTEND_ORIGIN="https://${FRONTEND_DOMAIN}:${NGINX_PORT}"; fi
  fi
  if [ -n "$BACKEND_DOMAIN" ]; then
    if [ "$NGINX_PORT" = "443" ]; then BACKEND_ORIGIN="https://${BACKEND_DOMAIN}"; else BACKEND_ORIGIN="https://${BACKEND_DOMAIN}:${NGINX_PORT}"; fi
  fi
else
  FRONTEND_ORIGIN="http://${FRONTEND_DOMAIN:-localhost}:${NGINX_PORT}"
  BACKEND_ORIGIN="http://${BACKEND_DOMAIN:-localhost}:${NGINX_PORT}"
fi
[ -z "${FRONTEND_ORIGIN:-}" ] && FRONTEND_ORIGIN="http://localhost:${NGINX_PORT}"
[ -z "${BACKEND_ORIGIN:-}" ] && BACKEND_ORIGIN="http://localhost:${NGINX_PORT}"
APP_ORIGIN="${FRONTEND_ORIGIN}"
WEBHOOK_URL="${BACKEND_ORIGIN}/api/whatsapp/webhook"; ENV_FILE="$APP_DIR/.env"
cat > "$ENV_FILE" <<EOF
PORT=${BACKEND_PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}
CORS_ORIGINS=${FRONTEND_ORIGIN},http://localhost:5173,http://localhost:5174
VITE_BACKEND_URL=${BACKEND_ORIGIN}/api
VITE_EVOLUTION_API_URL=${EVOLUTION_API_URL}
VITE_EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
VITE_EVOLUTION_WEBHOOK_URL=${WEBHOOK_URL}
VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE=/instance/qrCode/{instanceName}
EOF
cd "$APP_DIR"; if [ -f package.json ]; then npm ci || npm install; npm run build || true; else echo "[AVISO] package.json não encontrado"; fi
mkdir -p "$WEBROOT"; [ -d "$APP_DIR/dist" ] && rsync -a --delete "$APP_DIR/dist/" "$WEBROOT/" || cp -r "$APP_DIR/dist/"* "$WEBROOT/" 2>/dev/null || true

echo "[5/9] systemd"; UNIT="/etc/systemd/system/chatnegocios.service"
cat > "$UNIT" <<EOF
[Unit]
Description=ChatNegocios Backend
After=network.target
[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node server/app.cjs
Restart=always
EnvironmentFile=-${ENV_FILE}
User=$(id -un)
Group=$(id -gn)
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload || true; systemctl enable --now chatnegocios || true

echo "[6/9] Nginx"
# Detecta diretório de conf do Nginx e garante que existe
NG_SITES_AVAILABLE="/etc/nginx/sites-available"
NG_SITES_ENABLED="/etc/nginx/sites-enabled"
if [ -d "$NG_SITES_AVAILABLE" ]; then
  NGCONF="$NG_SITES_AVAILABLE/chatnegocios.conf"
  USE_SITES="1"
else
  NGCONF="/etc/nginx/conf.d/chatnegocios.conf"
  USE_SITES="0"
fi
mkdir -p "$(dirname "$NGCONF")"
[ "$USE_SITES" = "1" ] && mkdir -p "$NG_SITES_ENABLED"

if [ "$ENABLE_SSL" = "true" ] && { [ -n "$FRONTEND_DOMAIN" ] || [ -n "$BACKEND_DOMAIN" ]; }; then
  if [ -n "$BACKEND_DOMAIN" ] && [ "$BACKEND_DOMAIN" != "$FRONTEND_DOMAIN" ]; then
    # Dois domínios distintos: um para frontend e outro para API
    cat > "$NGCONF" <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};
    root ${WEBROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;
}
server {
    listen 80;
    server_name ${BACKEND_DOMAIN};

    location /api/whatsapp/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout 60s;
    }
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
}
EOF
    DOMS=( -d "$FRONTEND_DOMAIN" -d "$BACKEND_DOMAIN" )
  else
    # Um único domínio: frontend e API no mesmo host
    cat > "$NGCONF" <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
    listen 80;
    server_name ${FRONTEND_DOMAIN};
    root ${WEBROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/whatsapp/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout 60s;
    }
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

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;
}
EOF
    DOMS=( -d "$FRONTEND_DOMAIN" )
  fi
  [ "$USE_SITES" = "1" ] && ln -sf "$NGCONF" "$NG_SITES_ENABLED/chatnegocios.conf"
  [ "$USE_SITES" = "1" ] && rm -f "$NG_SITES_ENABLED/default" || true
  nginx -t || true; systemctl restart nginx || true
  apt-get install -y certbot python3-certbot-nginx || true
  if [ -n "$EMAIL" ] && [ ${#DOMS[@]} -gt 0 ]; then
    certbot --nginx -n --agree-tos -m "$EMAIL" "${DOMS[@]}" || echo "[AVISO] Falha ao obter SSL; verifique DNS/porta 80/liberação firewall"
    systemctl reload nginx || true
  else
    echo "[AVISO] SSL habilitado sem e-mail/domínios; execute certbot manualmente"
  fi
else
  cat > "$NGCONF" <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
    listen ${NGINX_PORT}; server_name _; root ${WEBROOT}; index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /api/whatsapp/ { proxy_pass http://127.0.0.1:${BACKEND_PORT}; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection \$connection_upgrade; proxy_read_timeout 60s; }
    location /api/ { proxy_pass http://127.0.0.1:${BACKEND_PORT}/; proxy_http_version 1.1; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection \$connection_upgrade; proxy_read_timeout 60s; }
    gzip on; gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; gzip_min_length 1024;
}
EOF
  [ "$USE_SITES" = "1" ] && ln -sf "$NGCONF" "$NG_SITES_ENABLED/chatnegocios.conf"
  [ "$USE_SITES" = "1" ] && rm -f "$NG_SITES_ENABLED/default" || true
  nginx -t || true; systemctl restart nginx || true
fi

echo "[7/9] Evolution API"
if [ -n "$EVOLUTION_API_URL" ] && [ -n "$EVOLUTION_API_KEY" ]; then
  if [ -n "$EVO_INSTANCE" ]; then
    CREATE_PAYLOAD=$(cat <<JSON
{ "instanceName": "${EVO_INSTANCE}", "qrcode": false, "integration": "WHATSAPP-BAILEYS", "webhook": { "url": "${WEBHOOK_URL}", "enabled": true, "events": ["MESSAGES_UPSERT","CONNECTION_UPDATE","QRCODE_UPDATED"] } }
JSON
)
    curl -s -X POST "${EVOLUTION_API_URL}/instance/create" -H "Content-Type: application/json" -H "apikey: ${EVOLUTION_API_KEY}" -H "X-API-Key: ${EVOLUTION_API_KEY}" -H "Authorization: Bearer ${EVOLUTION_API_KEY}" -d "${CREATE_PAYLOAD}" -o "/tmp/evo_create_${EVO_INSTANCE}.json" || true
    curl -s -X POST "${APP_ORIGIN}/api/connections" -H "Content-Type: application/json" -d "{\"user_id\":\"dev-user\",\"instance_name\":\"${EVO_INSTANCE}\",\"status\":\"DISCONNECTED\"}" || true
    curl -s -X GET "${EVOLUTION_API_URL}/instance/qrCode/${EVO_INSTANCE}" -H "Accept: application/json" -H "apikey: ${EVOLUTION_API_KEY}" -H "X-API-Key: ${EVOLUTION_API_KEY}" -H "Authorization: Bearer ${EVOLUTION_API_KEY}" -o "/tmp/evo_qr_${EVO_INSTANCE}.json" || true
    BASE64=$(jq -r '(.qrcode.base64 // .qrcode // .base64 // .code) // ""' "/tmp/evo_qr_${EVO_INSTANCE}.json" || echo "")
    if [ -n "$BASE64" ] && [ "$BASE64" != "null" ]; then echo "$BASE64" | base64 -d > "/tmp/${EVO_INSTANCE}_qr.png" 2>/dev/null || true; echo "[OK] QR: /tmp/${EVO_INSTANCE}_qr.png"; else echo "[AVISO] QR não retornado"; fi
  fi
else
  echo "[AVISO] Evolution não configurada (use --evo-url e --evo-key)."
fi

echo "[8/9] Serviços"; systemctl --no-pager status chatnegocios || true; systemctl --no-pager status nginx || true

echo "[9/9] Concluído"; echo "Frontend: ${APP_ORIGIN}"; echo "API: ${APP_ORIGIN}/api"; echo "Webhook: ${WEBHOOK_URL}"; echo "Postgres: 127.0.0.1:${DB_PORT} DB=${DB_NAME} USER=${DB_USER}"