#!/usr/bin/env bash
set -euo pipefail

# Chat Negócios — Instalador para Ubuntu
# Este script instala dependências, configura Nginx + SSL, constrói o frontend
# e configura o backend completo (Node/Express) com proxy via Nginx e vhost opcional para Evolution API.

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
APP_PORT=3000
BACKEND_FILE="$APP_DIR/server/app.cjs"
WEBHOOK_PATH="/api/evolution/webhook"
HTTP_PORT=80
ALT_HTTP_PORT=8080
TARGET_HTTP_PORT=$HTTP_PORT
SSL_PORT=443
FORCE_HTTP_ONLY=0
SKIP_SSL=0
SSL_ENABLED=0

# Evolution API vhost (opcional): configura domínio e porta para proxy
# Valores padrão podem ser sobrescritos via variáveis de ambiente
EVO_DOMAIN="${EVO_DOMAIN:-api.nowhats.com.br}"
EVO_TARGET_PORT="${EVO_TARGET_PORT:-8080}"
CONFIGURE_EVO_VHOST="${CONFIGURE_EVO_VHOST:-1}"
EVO_SSL_ENABLED=0
AUTO_GENERATE_EVO_TOKEN="${AUTO_GENERATE_EVO_TOKEN:-1}"
EVO_DIR="${EVO_DIR:-/opt/evolution-api}"

# Evitar conflito entre domínio da aplicação e domínio da Evolution API
if [[ "$EVO_DOMAIN" == "$DOMAIN" ]]; then
  echo "[ERRO] EVO_DOMAIN deve ser diferente de DOMAIN para evitar servir a UI da aplicação no domínio da API." >&2
  exit 1
fi

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

      # Recriar configuração Nginx com SSL e redirecionamento (proxy backend)
      cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
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

echo "\n[4/8] (Opcional) Gerando token/apikey da Evolution API para usar no build..."
if [[ "${AUTO_GENERATE_EVO_TOKEN}" -eq 1 ]]; then
  if [[ -f "$APP_DIR/scripts/generate-evo-token.sh" ]]; then
    bash "$APP_DIR/scripts/generate-evo-token.sh" --domain "$EVO_DOMAIN" --evo-dir "$EVO_DIR" --vite-env "$APP_DIR/.env.production" --webhook-url "https://${DOMAIN}${WEBHOOK_PATH}" || true
  else
    echo "[AVISO] Script generate-evo-token.sh não encontrado. Pulando geração automática de apikey."
  fi
fi

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

echo "\n[6/8] Configurando backend completo (Node/Express) via PM2..."
cd "$APP_DIR"
if [[ ! -f "$BACKEND_FILE" ]]; then
  echo "[ERRO] Backend não encontrado em $BACKEND_FILE. Verifique o repositório." >&2
  exit 1
fi
# Exportar variáveis de ambiente básicas
export PORT="$APP_PORT"
export WEBHOOK_PATH="$WEBHOOK_PATH"
# DATABASE_URL é opcional; o app faz fallback para pg-mem se ausente
pm2 start "$BACKEND_FILE" --name chatnegocios --env "production" || pm2 restart chatnegocios || true
pm2 save || true
systemctl enable pm2-$(whoami) || true

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

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA para backend Node
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
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

CF_TOKEN=${CLOUDFLARE_API_TOKEN:-}
CF_INI="/etc/letsencrypt/cloudflare.ini"
if [[ -n "$CF_TOKEN" ]]; then
  echo "[INFO] Detectado CLOUDFLARE_API_TOKEN. Tentando emissão via DNS-01 (Cloudflare)."
  apt-get update -y || true
  apt-get install -y python3-certbot-dns-cloudflare || true
  umask 077
  printf "dns_cloudflare_api_token = %s\n" "$CF_TOKEN" > "$CF_INI"
  if certbot certonly --dns-cloudflare --dns-cloudflare-credentials "$CF_INI" -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive; then
    SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

    # Configura Nginx: porta HTTP redireciona para HTTPS e 443 faz proxy para backend Node
    cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen ${SSL_PORT} ssl;
    listen [::]:${SSL_PORT} ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
    }
}
EOF

    ln -sf "$NGINX_SITE" "$NGINX_LINK"
    rm -f /etc/nginx/sites-enabled/default || true
    if ! nginx -t; then
      echo "[ERRO] Configuração Nginx com SSL inválida após DNS-01. Verifique $NGINX_SITE e os certificados."
      journalctl -u nginx --no-pager -n 50 || true
      exit 1
    fi
    systemctl start nginx || systemctl restart nginx || true
    SSL_ENABLED=1
  else
    echo "[AVISO] Emissão via DNS-01 (Cloudflare) falhou. Continuando com TLS-ALPN/HTTP-01..."
  fi
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

      # Recriar configuração Nginx com SSL e redirecionamento 80->443 (proxy para backend)
      cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
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

    # Configuração Nginx com SSL em 443 e redirecionamento da porta alternativa (proxy backend)
  cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen ${SSL_PORT} ssl;
    listen [::]:${SSL_PORT} ssl;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
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
      # Voltar Nginx sem SSL na porta alternativa (proxy backend)
      cat > "$NGINX_SITE" <<EOF
server {
    listen ${TARGET_HTTP_PORT};
    listen [::]:${TARGET_HTTP_PORT};
    server_name ${DOMAIN};

    # Proxy API
    location /api/ {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/api/;
    }

    # Proxy Webhook
    location ${WEBHOOK_PATH} {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}${WEBHOOK_PATH};
    }

    # Proxy SPA
    location / {
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_pass http://127.0.0.1:${APP_PORT}/;
    }
}
EOF
    ln -sf "$NGINX_SITE" "$NGINX_LINK"
    rm -f /etc/nginx/sites-enabled/default || true
    nginx -t && systemctl start nginx || systemctl restart nginx || true
    fi
fi

echo "\nPM2: backend rodando em nome 'chatnegocios' na porta ${APP_PORT}."

# Configurar vhost da Evolution API, se habilitado
if [[ "${CONFIGURE_EVO_VHOST}" -eq 1 ]]; then
  echo "\n[Extra] Configurando vhost Evolution API para ${EVO_DOMAIN} (upstream ${EVO_TARGET_PORT})..."
  EVO_SITE="/etc/nginx/sites-available/${EVO_DOMAIN}.conf"
  EVO_LINK="/etc/nginx/sites-enabled/${EVO_DOMAIN}.conf"

  cat > "$EVO_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${EVO_DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 15s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_buffering off;
    }

    location /health {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT}/health;
        proxy_set_header Host \$host;
    }
}
EOF

  ln -sf "$EVO_SITE" "$EVO_LINK"
  rm -f /etc/nginx/sites-enabled/default || true
  if nginx -t; then
    systemctl reload nginx || systemctl restart nginx || true
  else
    echo "[ERRO] Configuração Nginx da Evolution API inválida. Verifique $EVO_SITE." >&2
    journalctl -u nginx --no-pager -n 50 || true
  fi

  echo "\n[SSL] Emitindo certificado para ${EVO_DOMAIN} via plugin Nginx..."
  if certbot --nginx -d "$EVO_DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect; then
    systemctl reload nginx || true
    EVO_SSL_ENABLED=1
  else
    echo "[AVISO] Falha ao emitir certificado para Evolution via plugin Nginx. Tentando fallback standalone..."
    systemctl stop nginx || true
    fuser -k 80/tcp || true

    if certbot certonly --standalone -d "$EVO_DOMAIN" -m "$EMAIL" --agree-tos --non-interactive; then
      SSL_CERT="/etc/letsencrypt/live/${EVO_DOMAIN}/fullchain.pem"
      SSL_KEY="/etc/letsencrypt/live/${EVO_DOMAIN}/privkey.pem"

      cat > "$EVO_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${EVO_DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${EVO_DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 15s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_buffering off;
    }

    location /health {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT}/health;
        proxy_set_header Host \$host;
    }
}
EOF

      ln -sf "$EVO_SITE" "$EVO_LINK"
      rm -f /etc/nginx/sites-enabled/default || true
      if nginx -t; then
        systemctl start nginx || systemctl restart nginx || true
        EVO_SSL_ENABLED=1
      else
        echo "[ERRO] Configuração Nginx SSL da Evolution API inválida. Verifique $EVO_SITE e certificados." >&2
        journalctl -u nginx --no-pager -n 50 || true
      fi
    else
      echo "[ERRO] Falha ao emitir certificado SSL para Evolution (standalone). Consulte /var/log/letsencrypt/letsencrypt.log" >&2
    fi
  fi
fi

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
echo "Backend: rodando via PM2 em http://127.0.0.1:${APP_PORT}/"
echo "Para logs do backend: pm2 logs chatnegocios"
echo "Para status do PM2: pm2 status"
echo "Para renovar SSL (cron padrão do certbot já cuida): certbot renew --dry-run"
if [[ "${CONFIGURE_EVO_VHOST}" -eq 1 ]]; then
  if [[ "$EVO_SSL_ENABLED" -eq 1 ]]; then
    echo "Evolution API: https://${EVO_DOMAIN}/ (proxy para 127.0.0.1:${EVO_TARGET_PORT})"
  else
    echo "Evolution API: http://${EVO_DOMAIN}/ (proxy para 127.0.0.1:${EVO_TARGET_PORT})"
    echo "  (sem SSL; você pode ativar depois rodando certbot ou reexecutando o instalador)"
  fi
fi
echo "\nImportante: configure esta URL de webhook no Manager Evolution e no .env como VITE_EVOLUTION_WEBHOOK_URL."

exit 0