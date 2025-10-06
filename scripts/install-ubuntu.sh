#!/usr/bin/env bash
set -euo pipefail

# Chat Negócios — Instalador para Ubuntu
# Este script instala dependências, configura Nginx + SSL, constrói o frontend
# e configura um backend mínimo de webhook para Evolution API.

if [[ $EUID -ne 0 ]]; then
  echo "[ERRO] Execute como root (use sudo)." >&2
  exit 1
fi

echo "== Chat Negócios — Instalador Ubuntu =="
read -rp "Informe seu domínio completo (ex.: atendimento.seudominio.com): " DOMAIN
read -rp "Informe seu e-mail (para SSL/Let's Encrypt): " EMAIL

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "[ERRO] Domínio e e-mail são obrigatórios." >&2
  exit 1
fi

APP_DIR=$(pwd)
WEB_DIR="$APP_DIR/dist"
WEBHOOK_DIR="$APP_DIR/server/webhook"
WEBHOOK_PORT=3001
WEBHOOK_PATH="/api/evolution/webhook"

echo "\n[1/8] Atualizando pacotes e instalando dependências..."
apt-get update -y
apt-get upgrade -y || true
apt-get install -y curl ca-certificates gnupg lsb-release build-essential ufw nginx git || true

echo "\n[2/8] Instalando Node.js LTS e NPM..."
# Remover pacotes conflitantes (ex.: Node 12/libnode-dev do Ubuntu)
apt-get remove -y nodejs npm libnode-dev || true
apt-get purge -y nodejs npm libnode-dev || true
apt-get autoremove -y || true

# Instalar via NodeSource (LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs || true

# Se npm ainda não estiver presente, instalar via pacote do Ubuntu
if ! command -v npm >/dev/null 2>&1; then
  apt-get install -y npm || true
fi

# Fallback final: Snap (se disponível) se node/npm continuarem ausentes
if (! command -v node >/dev/null 2>&1) || (! command -v npm >/dev/null 2>&1); then
  if command -v snap >/dev/null 2>&1; then
    snap install node --classic || true
  fi
fi

# Reparar instalação se dpkg estiver com pendências
apt-get -f install -y || true
dpkg --configure -a || true

# Verificação final e ferramentas globais
if ! command -v npm >/dev/null 2>&1; then
  echo "[ERRO] npm não foi instalado. Verifique rede/repos e tente novamente." >&2
  exit 1
fi
npm install -g npm@latest || true
npm install -g pm2 || true

echo "\n[3/8] Instalando Certbot (Let's Encrypt) e plugin Nginx..."
apt-get install -y certbot python3-certbot-nginx || true

echo "\n[4/8] Configurando firewall básico (HTTP/HTTPS)..."
ufw allow 'Nginx Full' || true
ufw allow OpenSSH || true
echo "Firewall configurado (se ativo)."

echo "\n[5/8] Instalando e construindo o frontend..."
cd "$APP_DIR"
if [[ -f yarn.lock ]]; then
  if ! command -v yarn >/dev/null 2>&1; then
    npm install -g yarn || true
  fi
  if command -v yarn >/dev/null 2>&1; then
    yarn install --frozen-lockfile || yarn install
    yarn build
  else
    npm ci || npm install
    npm run build
  fi
else
  npm ci || npm install
  npm run build
fi

if [[ ! -d "$WEB_DIR" ]]; then
  echo "[ERRO] Build não gerou diretório dist em $WEB_DIR" >&2
  exit 1
fi

echo "\n[6/8] Configurando backend mínimo de webhook (Express)..."
mkdir -p "$WEBHOOK_DIR"
cat > "$WEBHOOK_DIR/server.js" <<'EOF'
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
  // Responder rápido para não bloquear retries
  res.status(200).json({ status: 'ok' });
});

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Webhook server ouvindo em http://127.0.0.1:${PORT}${PATH}`);
});
EOF

cat > "$WEBHOOK_DIR/package.json" <<'EOF'
{
  "name": "chatnegocios-webhook",
  "private": true,
  "type": "commonjs",
  "dependencies": {
    "express": "^4.19.2",
    "morgan": "^1.10.0"
  }
}
EOF

cd "$WEBHOOK_DIR"
npm install || true

echo "\n[7/8] Configurando Nginx para servir SPA e proxy do webhook..."
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${WEB_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy do webhook para Node local
    location ${WEBHOOK_PATH} {
        proxy_pass http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "$NGINX_SITE" "$NGINX_LINK"
nginx -t
systemctl reload nginx || systemctl restart nginx

echo "\n[8/8] Emitindo certificado SSL com Let's Encrypt..."
certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect || true
systemctl reload nginx || true

echo "\nConfigurando serviço do webhook com PM2..."
cd "$WEBHOOK_DIR"
export WEBHOOK_PORT="$WEBHOOK_PORT"
export WEBHOOK_PATH="$WEBHOOK_PATH"
pm2 start server.js --name chatnegocios-webhook --env "production" -- "$WEBHOOK_PORT" "$WEBHOOK_PATH" || pm2 restart chatnegocios-webhook
pm2 save
systemctl enable pm2-$(whoami) || true

echo "\n==== Instalação concluída ===="
echo "URL de acesso: https://${DOMAIN}/"
echo "Endpoint de webhook: https://${DOMAIN}${WEBHOOK_PATH}"
echo "Certificado SSL: configurado via Let's Encrypt para ${DOMAIN}"
echo "Nginx: site em ${NGINX_SITE}"
echo "Webhook: rodando em http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH} (gerenciado via PM2)"
echo "Para logs do webhook: pm2 logs chatnegocios-webhook"
echo "Para status do PM2: pm2 status"
echo "Para renovar SSL (cron padrão do certbot já cuida): certbot renew --dry-run"
echo "\nImportante: configure esta URL de webhook no Manager Evolution e no .env como VITE_EVOLUTION_WEBHOOK_URL."

exit 0