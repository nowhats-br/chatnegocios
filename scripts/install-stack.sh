#!/usr/bin/env bash
set -euo pipefail

# Novo instalador de excelência: Evolution (porta 8080), ChatNegócios (porta 8081),
# Nginx com SSL em 8443, Portainer e estruturas isoladas.
# Requisitos: Ubuntu/Debian server com sudo, domínios apontando para o servidor
# e token Cloudflare com permissão DNS (Edit Zone).

# Uso:
#   sudo bash scripts/install-stack.sh \
#     --evolution-domain evolution.seudominio.com \
#     --chat-frontend-domain app.seudominio.com \
#     --chat-backend-domain api.seudominio.com \
#     --email admin@seudominio.com \
#     --dns-cloudflare-token "<TOKEN_CF>" \
#     --chat-port 8081 --evolution-port 8080 --nginx-ssl-port 8443 \
#     --chat-app-dir /opt/chatnegocios --chat-webroot /var/www/chatnegocios/frontend \
#     --install-portainer
#
# Após rodar, acesse:
#   - Evolution: https://evolution.seudominio.com:8443
#   - Frontend: https://app.seudominio.com:8443
#   - Backend:  https://api.seudominio.com:8443
# Para Cloudflare Proxied (nuvem laranja), mude o nginx-ssl-port para 443 e
# garanta que 443 esteja livre.

if [[ $(id -u) -ne 0 ]]; then
  echo "Este script precisa ser executado como root (sudo)." >&2
  exit 1
fi

EVOLUTION_DOMAIN=""
CHAT_FRONTEND_DOMAIN=""
CHAT_BACKEND_DOMAIN=""
EMAIL=""
CF_TOKEN=""
CHAT_PORT=8081
EVOLUTION_PORT=8080
NGINX_SSL_PORT=8443
CHAT_APP_DIR="/opt/chatnegocios"
CHAT_WEBROOT="/var/www/chatnegocios/frontend"
INSTALL_PORTAINER=false

# Parse argumentos simples
while [[ $# -gt 0 ]]; do
  case "$1" in
    --evolution-domain) EVOLUTION_DOMAIN="$2"; shift 2;;
    --chat-frontend-domain) CHAT_FRONTEND_DOMAIN="$2"; shift 2;;
    --chat-backend-domain) CHAT_BACKEND_DOMAIN="$2"; shift 2;;
    --email) EMAIL="$2"; shift 2;;
    --dns-cloudflare-token) CF_TOKEN="$2"; shift 2;;
    --chat-port) CHAT_PORT="$2"; shift 2;;
    --evolution-port) EVOLUTION_PORT="$2"; shift 2;;
    --nginx-ssl-port) NGINX_SSL_PORT="$2"; shift 2;;
    --chat-app-dir) CHAT_APP_DIR="$2"; shift 2;;
    --chat-webroot) CHAT_WEBROOT="$2"; shift 2;;
    --install-portainer) INSTALL_PORTAINER=true; shift;;
    *) echo "Argumento desconhecido: $1"; exit 1;;
  esac
done

# Validações
for VAR in EVOLUTION_DOMAIN CHAT_FRONTEND_DOMAIN CHAT_BACKEND_DOMAIN EMAIL CF_TOKEN; do
  if [[ -z "${!VAR}" ]]; then
    echo "Faltando parâmetro obrigatório: --${VAR,,}" >&2
    MISSING=true
  fi
done
if [[ "${MISSING:-false}" == true ]]; then
  echo "Consulte o cabeçalho do script para uso." >&2
  exit 1
fi

# Helper: checa se porta está em uso
is_port_busy() {
  local PORT="$1"
  ss -tulpen | awk -v p=":${PORT}" '$5 ~ p {print $0}' | grep -q ":${PORT}" || return 1
}

log() { echo "[install] $*"; }

log "Atualizando pacotes e instalando dependências básicas"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release jq nginx certbot python3-certbot-dns-cloudflare rsync git

# Instalar Node.js LTS (v20) para backend ChatNegócios
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Purga sites padrão do Nginx e garante diretórios
rm -f /etc/nginx/sites-enabled/default || true
rm -f /etc/nginx/conf.d/default.conf || true
mkdir -p /etc/nginx/conf.d

# Instala Docker + Compose plugin
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  log "Instalando Docker Compose plugin"
  apt-get install -y docker-compose-plugin
fi

# Instala Portainer (opcional)
if [[ "$INSTALL_PORTAINER" == true ]]; then
  log "Instalando Portainer"
  docker volume create portainer_data >/dev/null 2>&1 || true
  docker rm -f portainer >/dev/null 2>&1 || true
  docker run -d \
    -p 8000:8000 -p 9443:9443 -p 9000:9000 \
    --name portainer --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest
fi

# Diretórios das apps
mkdir -p /opt/evolution /opt/chatnegocios "$CHAT_WEBROOT"

# Evolution via Docker na porta ${EVOLUTION_PORT}
if is_port_busy "$EVOLUTION_PORT"; then
  echo "A porta ${EVOLUTION_PORT} já está em uso. Libere-a ou altere --evolution-port." >&2
  exit 1
fi

# Tenta puxar imagem pública v2.3.4; se falhar, faz build local
EVOLUTION_IMAGE="atendai/evolution-api:v2.3.4"
LOCAL_EV_IMAGE="evolution-api:v2.3.4-local"
log "Obtendo imagem do Evolution: ${EVOLUTION_IMAGE}"
if ! docker pull "$EVOLUTION_IMAGE" >/dev/null 2>&1; then
  log "Pull falhou. Construindo imagem local ${LOCAL_EV_IMAGE} a partir do repositório."
  apt-get install -y git
  rm -rf /opt/evolution/src || true
  # Tenta usar a tag v2.3.4; se não existir, clona main
  git clone --depth 1 --branch v2.3.4 https://github.com/EvolutionAPI/evolution-api.git /opt/evolution/src || \
    git clone --depth 1 https://github.com/EvolutionAPI/evolution-api.git /opt/evolution/src
  ( cd /opt/evolution/src && docker build -t "$LOCAL_EV_IMAGE" . )
  USE_LOCAL_IMAGE=true
else
  USE_LOCAL_IMAGE=false
fi

log "Subindo Evolution na porta ${EVOLUTION_PORT}"
cat > /opt/evolution/docker-compose.yml <<'YAML'
version: "3.9"
services:
  evolution:
    image: atendai/evolution-api:v2.3.4
    container_name: evolution
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - LOG_LEVEL=info
    volumes:
      - evolution_data:/evolution/instances
volumes:
  evolution_data:
YAML

# Se a imagem local foi construída, usa ela no compose
if [[ "$USE_LOCAL_IMAGE" == true ]]; then
  sed -i "s|image: atendai/evolution-api:v2.3.4|image: ${LOCAL_EV_IMAGE}|" /opt/evolution/docker-compose.yml
fi

# Substitui mapeamento de portas se EVOLUTION_PORT != 8080
if [[ "$EVOLUTION_PORT" != "8080" ]]; then
  sed -i "s/\"8080:8080\"/\"${EVOLUTION_PORT}:8080\"/" /opt/evolution/docker-compose.yml
fi

( cd /opt/evolution && docker compose up -d )

# ChatNegócios Backend na porta 3003 como serviço systemd
log "Configurando ChatNegócios backend na porta ${CHAT_PORT}"
# Espera-se que o código da app esteja em ${CHAT_APP_DIR}
# este script cria o service file e usa node para rodar app.cjs

if [[ ! -f "${CHAT_APP_DIR}/server/app.cjs" ]]; then
  echo "Arquivo ${CHAT_APP_DIR}/server/app.cjs não encontrado. Copie o projeto para ${CHAT_APP_DIR}" >&2
  exit 1
fi

cat > /etc/systemd/system/chatnegocios.service <<SERVICE
[Unit]
Description=ChatNegócios Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=${CHAT_APP_DIR}/server
Environment=PORT=${CHAT_PORT}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${CHAT_APP_DIR}/server/app.cjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable chatnegocios.service
systemctl restart chatnegocios.service || (journalctl -u chatnegocios.service -n 200 --no-pager; exit 1)

# Frontend build (se aplicável):
if [[ -d "${CHAT_APP_DIR}" ]]; then
  log "Construindo frontend (se projeto presente)"
  if [[ -f "${CHAT_APP_DIR}/package.json" ]]; then
    ( cd "${CHAT_APP_DIR}" && npm ci && npm run build ) || true
    if [[ -d "${CHAT_APP_DIR}/dist" ]]; then
      rsync -a --delete "${CHAT_APP_DIR}/dist/" "${CHAT_WEBROOT}/"
    fi
  fi
fi

# Certificados via DNS-01 Cloudflare
log "Emitindo certificados SSL via DNS-01 (Cloudflare)"
CF_INI="/etc/letsencrypt/cloudflare.ini"
cat > "$CF_INI" <<EOF
dns_cloudflare_api_token = $CF_TOKEN
EOF
chmod 600 "$CF_INI"

ALL_DOMAINS=("$EVOLUTION_DOMAIN" "$CHAT_FRONTEND_DOMAIN" "$CHAT_BACKEND_DOMAIN")
CERT_ARGS=()
for d in "${ALL_DOMAINS[@]}"; do
  CERT_ARGS+=( -d "$d" )
done

certbot certonly --dns-cloudflare --dns-cloudflare-credentials "$CF_INI" \
  -m "$EMAIL" -n --agree-tos "${CERT_ARGS[@]}"

PRIMARY_DIR="/etc/letsencrypt/live/${EVOLUTION_DOMAIN}"
if [[ ! -d "$PRIMARY_DIR" ]]; then
  echo "Diretório de certificado não encontrado: $PRIMARY_DIR" >&2
  exit 1
fi

FULLCHAIN="$PRIMARY_DIR/fullchain.pem"
PRIVKEY="$PRIMARY_DIR/privkey.pem"

# Nginx conf com SSL na porta customizada e proxy
log "Gerando configuração Nginx (SSL na porta ${NGINX_SSL_PORT})"
cat > /etc/nginx/conf.d/chatnegocios_stack.conf <<NGINX
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }

server {
  listen ${NGINX_SSL_PORT} ssl http2;
  server_name ${EVOLUTION_DOMAIN};

  ssl_certificate ${FULLCHAIN};
  ssl_certificate_key ${PRIVKEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  location / {
    proxy_pass http://127.0.0.1:${EVOLUTION_PORT};
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 300;
    proxy_send_timeout 300;
  }
}

server {
  listen ${NGINX_SSL_PORT} ssl http2;
  server_name ${CHAT_BACKEND_DOMAIN};

  ssl_certificate ${FULLCHAIN};
  ssl_certificate_key ${PRIVKEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  location / {
    proxy_pass http://127.0.0.1:${CHAT_PORT};
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 300;
    proxy_send_timeout 300;
  }
}

server {
  listen ${NGINX_SSL_PORT} ssl http2;
  server_name ${CHAT_FRONTEND_DOMAIN};

  ssl_certificate ${FULLCHAIN};
  ssl_certificate_key ${PRIVKEY};
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  root ${CHAT_WEBROOT};
  index index.html;

  location / {
    try_files \$uri /index.html;
  }
}
NGINX

nginx -t
systemctl restart nginx
systemctl status nginx --no-pager -l || true

log "Concluído com sucesso. Acesse seus serviços em HTTPS na porta ${NGINX_SSL_PORT}."