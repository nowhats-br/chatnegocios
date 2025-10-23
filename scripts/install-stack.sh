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
#     # ou use o formato com igual:
#     # --dns-cloudflare-token=<TOKEN_CF> \

#     --chat-port 8081 --evolution-port 8080 --nginx-ssl-port 8443 \
#     --chat-app-dir /opt/chatnegocios --chat-webroot /var/www/chatnegocios/frontend \
#     --cf-propagation-seconds 120 \
#     --evolution-api-key "evo-api-key" \
#     --force-reinstall-evolution \
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
CF_PROPAGATION_SECONDS=120

EVOLUTION_API_KEY=""
FORCE_REINSTALL_EVOLUTION=false

# Parse argumentos (suporta --flag=valor e --flag valor)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --*=*)
      KEY="${1%%=*}"
      VAL="${1#*=}"
      case "$KEY" in
        --evolution-domain) EVOLUTION_DOMAIN="$VAL";;
        --chat-frontend-domain) CHAT_FRONTEND_DOMAIN="$VAL";;
        --chat-backend-domain) CHAT_BACKEND_DOMAIN="$VAL";;
        --email) EMAIL="$VAL";;
        --dns-cloudflare-token) CF_TOKEN="$VAL";;
        --chat-port) CHAT_PORT="$VAL";;
        --evolution-port) EVOLUTION_PORT="$VAL";;
        --nginx-ssl-port) NGINX_SSL_PORT="$VAL";;
        --chat-app-dir) CHAT_APP_DIR="$VAL";;
        --chat-webroot) CHAT_WEBROOT="$VAL";;
        --cf-propagation-seconds) CF_PROPAGATION_SECONDS="$VAL";;
        --evolution-api-key) EVOLUTION_API_KEY="$VAL";;
        --force-reinstall-evolution) FORCE_REINSTALL_EVOLUTION=true;;
        --install-portainer) INSTALL_PORTAINER=true;;
        *) echo "Argumento desconhecido: $1"; exit 1;;
      esac
      shift
      ;;
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
    --cf-propagation-seconds) CF_PROPAGATION_SECONDS="$2"; shift 2;;
    --install-portainer) INSTALL_PORTAINER=true; shift;;
    --evolution-api-key) EVOLUTION_API_KEY="$2"; shift 2;;
    --force-reinstall-evolution) FORCE_REINSTALL_EVOLUTION=true; shift;;
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

# Checagem de DNS: confirmar que domínios apontam para este servidor
resolve_ip() {
  local DOMAIN="$1"
  local IP=""
  IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n 1)
  if [[ -z "$IP" ]]; then
    IP=$(dig +short "$DOMAIN" 2>/dev/null | head -n 1 || true)
  fi
  echo "$IP"
}
SERVER_IP=$(curl -s https://api.ipify.org || curl -s ifconfig.me || true)
for d in "$EVOLUTION_DOMAIN" "$CHAT_FRONTEND_DOMAIN" "$CHAT_BACKEND_DOMAIN"; do
  RESOLVED=$(resolve_ip "$d")
  if [[ -z "$RESOLVED" ]]; then
    echo "[install] Aviso: domínio $d não resolve em DNS ainda. Configure o A/AAAA no Cloudflare." >&2
  elif [[ -n "$SERVER_IP" && "$RESOLVED" != "$SERVER_IP" ]]; then
    echo "[install] Aviso: $d resolve para $RESOLVED, mas o servidor é $SERVER_IP. Acesso externo pode falhar até ajustar DNS." >&2
  else
    echo "[install] DNS OK: $d aponta para $RESOLVED." >&2
  fi
done

# Helper: checa se porta está em uso
is_port_busy() {
  local PORT="$1"
  ss -tulpen | awk -v p=":${PORT}" '$5 ~ p {print $0}' | grep -q ":${PORT}" || return 1
}

log() { echo "[install] $*"; }

log "Atualizando pacotes e instalando dependências básicas"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release jq nginx certbot python3-certbot-dns-cloudflare rsync git openssl

# Instalar Node.js LTS (v22) para backend ChatNegócios
if command -v node >/dev/null 2>&1; then
  NODE_MAJ=$(node -v | sed 's/^v\([0-9]\+\).*/\1/')
  if [[ "$NODE_MAJ" -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    log "Node.js já presente (v$(node -v)); mantendo."
  fi
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Purga sites padrão do Nginx e garante diretórios
rm -f /etc/nginx/sites-enabled/default || true
rm -f /etc/nginx/sites-enabled/default-ssl || true
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
  log "Instalando/atualizando Portainer"
  docker volume create portainer_data >/dev/null 2>&1 || true
  docker pull portainer/portainer-ce:latest >/dev/null 2>&1 || true
  LATEST_ID=$(docker image inspect -f '{{.Id}}' portainer/portainer-ce:latest || true)
  if docker ps -a --format '{{.Names}}' | grep -q '^portainer$'; then
    CURRENT_ID=$(docker inspect -f '{{.Image}}' portainer || true)
    if [[ "$CURRENT_ID" != "$LATEST_ID" ]] || ! docker ps --format '{{.Names}}' | grep -q '^portainer$'; then
      log "Atualizando Portainer para latest"
      docker rm -f portainer >/dev/null 2>&1 || true
      docker run -d \
        -p 8000:8000 -p 9443:9443 -p 9000:9000 \
        --name portainer --restart=always \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        portainer/portainer-ce:latest
    else
      log "Portainer já instalado e atualizado; pulando."
    fi
  else
    docker run -d \
      -p 8000:8000 -p 9443:9443 -p 9000:9000 \
      --name portainer --restart=always \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v portainer_data:/data \
      portainer/portainer-ce:latest
  fi
fi

# Diretórios das apps
mkdir -p /opt/evolution /opt/chatnegocios "$CHAT_WEBROOT"

# Evolution: gerar/usar API key automaticamente se não fornecida
if [[ -z "${EVOLUTION_API_KEY:-}" ]]; then
  if [[ -f /opt/evolution/api.key ]]; then
    EVOLUTION_API_KEY=$(cat /opt/evolution/api.key)
    log "Usando API key Evolution existente em /opt/evolution/api.key"
  else
    EVOLUTION_API_KEY=$(openssl rand -hex 24)
    echo "$EVOLUTION_API_KEY" > /opt/evolution/api.key
    chmod 600 /opt/evolution/api.key
    log "Gerada API key Evolution e salva em /opt/evolution/api.key"
  fi
fi

# Evolution via Docker na porta ${EVOLUTION_PORT}
if is_port_busy "$EVOLUTION_PORT"; then
  if docker ps --format '{{.Names}} {{.Ports}}' | grep -qE '^evolution\s+.*:${EVOLUTION_PORT}->8080'; then
    log "Evolution já ativo na porta ${EVOLUTION_PORT}; continuando."
  else
    echo "A porta ${EVOLUTION_PORT} está em uso por outro processo. Altere --evolution-port." >&2
    exit 1
  fi
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
cat > /opt/evolution/docker-compose.yml <<YAML
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
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
    volumes:
      - evolution_store:/evolution/store
      - evolution_instances:/evolution/instances
volumes:
  evolution_store:
  evolution_instances:
YAML

# Se a imagem local foi construída, usa ela no compose
if [[ "$USE_LOCAL_IMAGE" == true ]]; then
  sed -i "s|image: atendai/evolution-api:v2.3.4|image: ${LOCAL_EV_IMAGE}|" /opt/evolution/docker-compose.yml
fi

# Substitui mapeamento de portas se EVOLUTION_PORT != 8080
if [[ "$EVOLUTION_PORT" != "8080" ]]; then
  sed -i "s/\"8080:8080\"/\"${EVOLUTION_PORT}:8080\"/" /opt/evolution/docker-compose.yml
fi

# Remove container existente se for requisitado forçar reinstalação
if docker ps -a --format '{{.Names}}' | grep -q '^evolution$'; then
  if [[ "$FORCE_REINSTALL_EVOLUTION" == true ]]; then
    log "Forçando reinstalação do Evolution: removendo container existente"
    docker rm -f evolution || true
  fi
fi

( cd /opt/evolution && docker compose up -d )

# Checagem de saúde do Evolution
log "Verificando saúde do Evolution em http://127.0.0.1:${EVOLUTION_PORT}"
EV_RETRY_END=$(( $(date +%s) + 60 ))
EV_HEALTH_OK=false
while [[ $(date +%s) -lt "$EV_RETRY_END" ]]; do
  if curl -sS -m 3 "http://127.0.0.1:${EVOLUTION_PORT}/" | grep -q "Evolution API"; then
    EV_HEALTH_OK=true
    break
  fi
  sleep 3
done
if [[ "$EV_HEALTH_OK" != true ]]; then
  log "Evolution não respondeu como esperado; reiniciando container e aguardando mais 30s"
  docker compose -f /opt/evolution/docker-compose.yml restart evolution || true
  EV_RETRY_END=$(( $(date +%s) + 30 ))
  while [[ $(date +%s) -lt "$EV_RETRY_END" ]]; do
    if curl -sS -m 3 "http://127.0.0.1:${EVOLUTION_PORT}/" | grep -q "Evolution API"; then
      EV_HEALTH_OK=true
      break
    fi
    sleep 3
  done
fi
if [[ "$EV_HEALTH_OK" != true ]]; then
  log "Aviso: Evolution ainda não respondeu; Nginx pode retornar 502 até estabilizar."
  log "Diagnóstico: status do container Evolution"
  docker ps -a --format '{{.Names}} {{.Status}} {{.Ports}}' | sed -n '/^evolution/p'
  log "Logs (últimas 200 linhas) do Evolution"
  docker logs --tail=200 evolution || true
  log "Mapeamentos de porta em uso (${EVOLUTION_PORT})"
  ss -tulpen | awk -v p=":${EVOLUTION_PORT}" '$5 ~ p {print $0}' || true
fi

# ChatNegócios Backend na porta 3003 como serviço systemd
log "Configurando ChatNegócios backend na porta ${CHAT_PORT}"
# Espera-se que o código da app esteja em ${CHAT_APP_DIR}
# este script cria o service file e usa node para rodar app.cjs

if [[ ! -f "${CHAT_APP_DIR}/server/app.cjs" ]]; then
  echo "Arquivo ${CHAT_APP_DIR}/server/app.cjs não encontrado. Copie o projeto para ${CHAT_APP_DIR}" >&2
  exit 1
fi

# Se porta ocupada, permite se o serviço já estiver ativo
if is_port_busy "$CHAT_PORT"; then
  if systemctl is-active --quiet chatnegocios.service; then
    log "ChatNegócios já ativo na porta ${CHAT_PORT}; mantendo."
  else
    echo "A porta ${CHAT_PORT} está em uso por outro processo. Altere --chat-port." >&2
    exit 1
  fi
fi

# Gerar arquivo de serviço apenas se mudou
TMP_SERVICE=/tmp/chatnegocios.service.new
cat > "$TMP_SERVICE" <<SERVICE
[Unit]
Description=ChatNegócios Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=${CHAT_APP_DIR}/server
Environment=PORT=${CHAT_PORT}
Environment=NODE_ENV=production
Environment=CORS_ORIGINS=https://${CHAT_FRONTEND_DOMAIN}:${NGINX_SSL_PORT},https://${CHAT_FRONTEND_DOMAIN}
ExecStart=/usr/bin/node ${CHAT_APP_DIR}/server/app.cjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
SERVICE

NEEDS_UPDATE=true
if [[ -f /etc/systemd/system/chatnegocios.service ]]; then
  if diff -q "$TMP_SERVICE" /etc/systemd/system/chatnegocios.service >/dev/null 2>&1; then
    NEEDS_UPDATE=false
  fi
fi

if [[ "$NEEDS_UPDATE" == true ]]; then
  mv "$TMP_SERVICE" /etc/systemd/system/chatnegocios.service
  systemctl daemon-reload
else
  rm -f "$TMP_SERVICE"
fi

systemctl enable chatnegocios.service
if systemctl is-active --quiet chatnegocios.service; then
  systemctl restart chatnegocios.service || (journalctl -u chatnegocios.service -n 200 --no-pager; exit 1)
else
  systemctl start chatnegocios.service || (journalctl -u chatnegocios.service -n 200 --no-pager; exit 1)
fi

# Frontend build (se aplicável):
if [[ -d "${CHAT_APP_DIR}" ]]; then
  log "Construindo frontend (se projeto presente)"
  if [[ -f "${CHAT_APP_DIR}/package.json" ]]; then
    ( cd "${CHAT_APP_DIR}" && npm ci && VITE_BACKEND_URL="https://${CHAT_BACKEND_DOMAIN}:${NGINX_SSL_PORT}" npm run build ) || true
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

PRIMARY_DIR="/etc/letsencrypt/live/${EVOLUTION_DOMAIN}"
FULLCHAIN="$PRIMARY_DIR/fullchain.pem"
PRIVKEY="$PRIMARY_DIR/privkey.pem"

SHOULD_ISSUE=true
if [[ -f "$FULLCHAIN" ]]; then
  END_DATE=$(openssl x509 -enddate -noout -in "$FULLCHAIN" | cut -d= -f2 || true)
  if [[ -n "$END_DATE" ]]; then
    END_EPOCH=$(date -d "$END_DATE" +%s)
    NOW_EPOCH=$(date +%s)
    REMAIN_DAYS=$(( (END_EPOCH - NOW_EPOCH) / 86400 ))
    if [[ "$REMAIN_DAYS" -gt 30 ]]; then
      log "Certificado existente válido por ${REMAIN_DAYS} dias; pulando emissão."
      SHOULD_ISSUE=false
    fi
  fi
fi

ISSUE_OK=false
if [[ "$SHOULD_ISSUE" == true ]]; then
  for secs in "$CF_PROPAGATION_SECONDS" 180 300; do
    log "Tentando emitir certificados (propagação DNS: ${secs}s)"
    if certbot certonly --dns-cloudflare --dns-cloudflare-credentials "$CF_INI" \
         --dns-cloudflare-propagation-seconds "$secs" \
         -m "$EMAIL" -n --agree-tos "${CERT_ARGS[@]}"; then
      ISSUE_OK=true
      break
    else
      log "Falha na emissão com ${secs}s; tentando novamente se houver próximos valores."
    fi
  done
fi

if [[ ! -d "$PRIMARY_DIR" ]]; then
  log "Certificados reais indisponíveis; gerando autoassinado como fallback para ${EVOLUTION_DOMAIN}/${CHAT_FRONTEND_DOMAIN}/${CHAT_BACKEND_DOMAIN}"
  mkdir -p "$PRIMARY_DIR"
  SSLCFG="/etc/letsencrypt/selfsigned.cnf"
  cat > "$SSLCFG" <<CFG
[req]
default_bits=2048
distinguished_name=req_distinguished_name
req_extensions=v3_req
prompt=no

[req_distinguished_name]
CN=${EVOLUTION_DOMAIN}

[v3_req]
subjectAltName=@alt_names

[alt_names]
DNS.1=${EVOLUTION_DOMAIN}
DNS.2=${CHAT_FRONTEND_DOMAIN}
DNS.3=${CHAT_BACKEND_DOMAIN}
CFG
  openssl req -x509 -nodes -days 14 -newkey rsa:2048 \
    -keyout "$PRIVKEY" -out "$FULLCHAIN" -config "$SSLCFG" -extensions v3_req
fi

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

# Cria redirecionamento HTTP->HTTPS somente se a porta 80 estiver livre
if ! is_port_busy 80; then
  log "Gerando redirecionamento HTTP (porta 80) para HTTPS:${NGINX_SSL_PORT}"
  cat > /etc/nginx/conf.d/chatnegocios_redirect80.conf <<REDIR
server {
  listen 80;
  server_name ${EVOLUTION_DOMAIN};
  return 301 https://\$host:${NGINX_SSL_PORT}\$request_uri;
}
server {
  listen 80;
  server_name ${CHAT_BACKEND_DOMAIN};
  return 301 https://\$host:${NGINX_SSL_PORT}\$request_uri;
}
server {
  listen 80;
  server_name ${CHAT_FRONTEND_DOMAIN};
  return 301 https://\$host:${NGINX_SSL_PORT}\$request_uri;
}
REDIR
fi

nginx -t
systemctl restart nginx
systemctl status nginx --no-pager -l || true

log "Concluído com sucesso. Acesse seus serviços em HTTPS na porta ${NGINX_SSL_PORT}."
log "Evolution API URL: https://${EVOLUTION_DOMAIN}:${NGINX_SSL_PORT}"
log "Evolution API key salva em: /opt/evolution/api.key"

# Verifica que o backend responde na porta configurada
HTTP_CODE=$(curl -s -o /dev/null -m 3 -w "%{http_code}" "http://127.0.0.1:${CHAT_PORT}/" || true)
if [[ -n "$HTTP_CODE" ]]; then
  log "Backend respondeu na raiz com HTTP ${HTTP_CODE}; 404 na raiz é normal para API."
fi
