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
HTTP_PORT=80
ALT_HTTP_PORT=8080
TARGET_HTTP_PORT=$HTTP_PORT
SSL_PORT=443
FORCE_HTTP_ONLY=0
SKIP_SSL=0
SSL_ENABLED=0

# Modo rápido: executar apenas correção de SSL/Nginx
MODE=${1:-}
PORT_ARG=${2:-}
if [[ -n "$PORT_ARG" && "$PORT_ARG" =~ ^[0-9]+$ ]]; then
  TARGET_HTTP_PORT=$PORT_ARG
fi
if [[ "$MODE" == "ssl-only" || "$MODE" == "--ssl-only" ]]; then
  echo "[MODO] ssl-only: executando apenas correção de SSL/Nginx (pula etapas 1–7)."

  # Garantir dependências mínimas
  apt-get update -y || true
  apt-get install -y nginx certbot python3-certbot-nginx psmisc || true

  NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}.conf"
  NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

  # Remover site padrão e habilitar serviço
  rm -f /etc/nginx/sites-enabled/default || true
  systemctl enable nginx || true
  systemctl start nginx || true

  echo "\n[SSL] Emitindo certificado com Certbot (plugin Nginx, com fallback)."
  # Se Apache estiver ocupando a porta 80, desligar
  if systemctl is-active --quiet apache2; then
    echo "[INFO] Apache2 ativo. Desativando para liberar porta 80..."
    systemctl stop apache2 || true
    systemctl disable apache2 || true
  fi

  # Tentar emitir via plugin Nginx
  if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect; then
    systemctl reload nginx || true
  else
    echo "[AVISO] Falha com plugin Nginx. Tentando modo standalone..."
    systemctl stop nginx || true
    fuser -k 80/tcp || true

    if certbot certonly --standalone -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive; then
      SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
      SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

      # Recriar configuração Nginx com SSL e redirecionamento
      cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    root ${WEB_DIR};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ${WEBHOOK_PATH} {
        proxy_pass http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

      ln -sf "$NGINX_SITE" "$NGINX_LINK"
      rm -f /etc/nginx/sites-enabled/default || true
      if ! nginx -t; then
        echo "[ERRO] Configuração Nginx/SSL inválida. Verifique $NGINX_SITE e certificados." >&2
        journalctl -u nginx --no-pager -n 50 || true
        exit 1
      fi
      systemctl start nginx || systemctl restart nginx || true
    else
      echo "[ERRO] Falha ao obter certificado SSL em modo standalone. Consulte /var/log/letsencrypt/letsencrypt.log" >&2
      exit 1
    fi
  fi

  echo "\n==== Correção SSL concluída ===="
  echo "URL de acesso: https://${DOMAIN}/"
  echo "Endpoint de webhook: https://${DOMAIN}${WEBHOOK_PATH}"
  exit 0
fi

# Modo rápido: servir sem SSL em porta específica (ex.: 81)
if [[ "$MODE" == "http-only" || "$MODE" == "--http-only" ]]; then
  FORCE_HTTP_ONLY=1
  SKIP_SSL=1
  if [[ -n "$PORT_ARG" && "$PORT_ARG" =~ ^[0-9]+$ ]]; then
    TARGET_HTTP_PORT=$PORT_ARG
  else
    TARGET_HTTP_PORT=81
  fi
  echo "[MODO] http-only: servindo sem SSL na porta ${TARGET_HTTP_PORT}."
fi

echo "\n[1/8] Atualizando pacotes e instalando dependências..."
apt-get update -y
apt-get upgrade -y || true
apt-get install -y curl ca-certificates gnupg lsb-release build-essential ufw nginx git psmisc || true

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

if [[ "$FORCE_HTTP_ONLY" -eq 1 ]]; then
  echo "[Pré-checagem] Modo http-only: usando porta ${TARGET_HTTP_PORT} sem tentar liberar 80."
  ufw allow ${TARGET_HTTP_PORT}/tcp || true
else
  echo "\n[Pré-checagem] Verificando ocupação da porta 80..."
  if ss -ltnp | grep -q ":80 "; then
    echo "[INFO] Porta 80 ocupada. Tentando liberar..."
    for svc in apache2 caddy traefik haproxy varnish; do
      if systemctl is-active --quiet "$svc"; then
        systemctl stop "$svc" || true
        systemctl disable "$svc" || true
      fi
    done
    fuser -k 80/tcp || true
    sleep 2
    if ss -ltnp | grep -q ":80 "; then
      echo "[AVISO] Não foi possível liberar a porta 80. Usaremos a porta ${ALT_HTTP_PORT} para HTTP."
      TARGET_HTTP_PORT=$ALT_HTTP_PORT
      ufw allow ${ALT_HTTP_PORT}/tcp || true
    fi
  fi
fi

cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
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
# Remover site padrão para evitar conflitos
rm -f /etc/nginx/sites-enabled/default || true

# Validar configuração do Nginx antes de aplicar
if ! nginx -t; then
  echo "[ERRO] Configuração do Nginx inválida. Saída do teste:" >&2
  nginx -t || true
  journalctl -u nginx --no-pager -n 50 || true
  exit 1
fi

# Garantir serviço habilitado e em execução
systemctl enable nginx || true
if systemctl is-active --quiet nginx; then
  systemctl reload nginx || systemctl restart nginx || true
else
  systemctl start nginx || systemctl restart nginx || true
fi

echo "\n[8/8] Emitindo certificado SSL com Let's Encrypt..."
# Garantir que nenhum outro servidor esteja ocupando a porta 80 (ex.: Apache)
if systemctl is-active --quiet apache2; then
  echo "[INFO] Apache2 está ativo na porta 80. Desativando para continuar com Nginx/Certbot..."
  systemctl stop apache2 || true
  systemctl disable apache2 || true
fi

if [[ "$SKIP_SSL" -eq 1 ]]; then
  echo "[INFO] Modo http-only: pulando emissão de SSL."
elif [[ "$TARGET_HTTP_PORT" -eq 80 ]]; then
  # Tentar emitir certificado usando o plugin Nginx (com redirecionamento automático)
  if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect; then
    systemctl reload nginx || true
    SSL_ENABLED=1
  else
    echo "[AVISO] Falha ao emitir certificado com o plugin Nginx. Tentando fallback em modo standalone..."
    # Parar Nginx para liberar a porta 80 ao standalone
    systemctl stop nginx || true
    # Liberar porta 80 (se algum processo desconhecido estiver prendendo)
    fuser -k 80/tcp || true

    if certbot certonly --standalone -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive; then
      SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
      SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

      # Recriar configuração Nginx com SSL e redirecionamento 80->443
      cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    root ${WEB_DIR};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy do webhook para Node local
    location ${WEBHOOK_PATH} {
        proxy_pass http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

      ln -sf "$NGINX_SITE" "$NGINX_LINK"
      rm -f /etc/nginx/sites-enabled/default || true
      if ! nginx -t; then
        echo "[ERRO] Configuração Nginx com SSL inválida. Verifique o arquivo $NGINX_SITE e os certificados."
        journalctl -u nginx --no-pager -n 50 || true
        exit 1
      fi
      systemctl start nginx || systemctl restart nginx || true
      SSL_ENABLED=1
    else
      echo "[ERRO] Falha ao obter certificado SSL com Certbot (modo standalone)." >&2
      echo "Consulte: /var/log/letsencrypt/letsencrypt.log" >&2
    fi
  fi
else
  echo "[AVISO] HTTP está na porta ${TARGET_HTTP_PORT}. Tentando emissão via TLS-ALPN-01 em 443 (sem usar 80)."
  systemctl stop nginx || true
  fuser -k 443/tcp || true

  if certbot certonly --standalone --preferred-challenges tls-alpn-01 -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive || certbot certonly --standalone --http-01-port ${TARGET_HTTP_PORT} -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive; then
    SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

    # Configuração Nginx com SSL em 443 e redirecionamento da porta alternativa
    cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
    server_name ${DOMAIN};
    return 301 https://$host$request_uri;
}

server {
    listen ${SSL_PORT} ssl;
    listen [::]:${SSL_PORT} ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root ${WEB_DIR};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy do webhook para Node local
    location ${WEBHOOK_PATH} {
        proxy_pass http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

      ln -sf "$NGINX_SITE" "$NGINX_LINK"
      rm -f /etc/nginx/sites-enabled/default || true
      if ! nginx -t; then
      echo "[ERRO] Configuração Nginx com SSL inválida. Verifique o arquivo $NGINX_SITE e os certificados."
      journalctl -u nginx --no-pager -n 50 || true
      exit 1
      fi
      systemctl start nginx || systemctl restart nginx || true
      SSL_ENABLED=1
    else
      echo "[ERRO] Falha ao obter certificado SSL com Certbot (TLS-ALPN e HTTP-01)." >&2
      echo "Consulte: /var/log/letsencrypt/letsencrypt.log" >&2
      echo "[INFO] Mantendo site sem SSL na porta ${TARGET_HTTP_PORT}. Para SSL, garanta que a porta 80 externa aponte para este servidor." >&2
      # Voltar Nginx sem SSL na porta alternativa
      cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
    server_name ${DOMAIN};

    root ${WEB_DIR};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ${WEBHOOK_PATH} {
        proxy_pass http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    ln -sf "$NGINX_SITE" "$NGINX_LINK"
    rm -f /etc/nginx/sites-enabled/default || true
    nginx -t && systemctl start nginx || systemctl restart nginx || true
    fi
fi

echo "\nConfigurando serviço do webhook com PM2..."
cd "$WEBHOOK_DIR"
export WEBHOOK_PORT="$WEBHOOK_PORT"
export WEBHOOK_PATH="$WEBHOOK_PATH"
pm2 start server.js --name chatnegocios-webhook --env "production" -- "$WEBHOOK_PORT" "$WEBHOOK_PATH" || pm2 restart chatnegocios-webhook
pm2 start server.js --name chatnegocios-webhook -f || true
pm2 save
systemctl enable pm2-$(whoami) || true

echo "\n==== Instalação concluída ===="
if [[ "$SSL_ENABLED" -eq 1 ]]; then
  echo "URL de acesso: https://${DOMAIN}/"
  echo "Endpoint de webhook: https://${DOMAIN}${WEBHOOK_PATH}"
  echo "Certificado SSL: configurado via Let's Encrypt para ${DOMAIN}"
else
  echo "URL de acesso: http://${DOMAIN}:${TARGET_HTTP_PORT}/"
  echo "Endpoint de webhook: http://${DOMAIN}:${TARGET_HTTP_PORT}${WEBHOOK_PATH}"
  echo "Certificado SSL: não configurado (modo HTTP)"
fi
echo "Nginx: site em ${NGINX_SITE}"
echo "Webhook: rodando em http://127.0.0.1:${WEBHOOK_PORT}${WEBHOOK_PATH} (gerenciado via PM2)"
echo "Para logs do webhook: pm2 logs chatnegocios-webhook"
echo "Para status do PM2: pm2 status"
echo "Para renovar SSL (cron padrão do certbot já cuida): certbot renew --dry-run"
echo "\nImportante: configure esta URL de webhook no Manager Evolution e no .env como VITE_EVOLUTION_WEBHOOK_URL."

exit 0