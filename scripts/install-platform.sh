#!/usr/bin/env bash
set -euo pipefail

# Instalador de Plataforma: Portainer + Traefik + Stacks ChatNegócios e Evolution
# - Instala Docker/Compose (se necessário)
# - Sobe Portainer (UI de containers)
# - Sobe Traefik como reverse proxy com Let's Encrypt
# - Cria stacks para ChatNegócios (porta interna 3000) e Evolution API (porta interna 8080)
# - Mantém serviços isolados, domínios e SSL automatizados via Traefik

if [[ $EUID -ne 0 ]]; then
  echo "[ERRO] Este script deve ser executado como root (use sudo)." >&2
  exit 1
fi

log() { echo "[install-platform] $*"; }

# Coleta variáveis
CHAT_DOMAIN="${CHAT_DOMAIN:-}"
EVO_DOMAIN="${EVO_DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-${SSL_EMAIL:-}}"
USE_STAGING="${USE_STAGING:-0}" # 1 para usar Let's Encrypt staging

CHAT_DB_PASS="${CHAT_DB_PASS:-ChatNegocios123!}"
EVO_DB_PASS="${EVO_DB_PASS:-Evolution123!}"
EVO_APIKEY="${EVO_APIKEY:-}"

if [[ -z "$CHAT_DOMAIN" ]]; then
  read -rp "Informe o domínio do ChatNegócios (ex: chat.seu-dominio.com): " CHAT_DOMAIN
fi
if [[ -z "$EVO_DOMAIN" ]]; then
  read -rp "Informe o domínio da Evolution API (ex: api.seu-dominio.com): " EVO_DOMAIN
fi
if [[ -z "$ACME_EMAIL" ]]; then
  read -rp "Informe o e-mail para certificados Let's Encrypt: " ACME_EMAIL
fi

sanitize_domain() {
  local d="$1"
  d="${d#https://}"; d="${d#http://}"
  d="${d%%/*}"; d="${d//\`/}"; d="${d//\"/}"; d="${d//\'/}"
  d="$(echo "$d" | tr -d '[:space:]')"
  echo "$d"
}
CHAT_DOMAIN="$(sanitize_domain "$CHAT_DOMAIN")"
EVO_DOMAIN="$(sanitize_domain "$EVO_DOMAIN")"

if [[ "$CHAT_DOMAIN" == "$EVO_DOMAIN" ]]; then
  echo "[ERRO] CHAT_DOMAIN e EVO_DOMAIN devem ser diferentes." >&2
  exit 1
fi

log "Resumo:"; echo "- Chat: $CHAT_DOMAIN"; echo "- Evolution: $EVO_DOMAIN"; echo "- ACME e-mail: $ACME_EMAIL"; echo "- Staging: $USE_STAGING"

# Instalar Docker e Compose
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker (get.docker.com)"
  curl -fsSL https://get.docker.com -o /tmp/getdocker.sh && sh /tmp/getdocker.sh || true
  if ! command -v docker >/dev/null 2>&1; then
    log "Fallback: instalar via apt"
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
fi
systemctl enable --now docker || true
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || true
fi

# Criar rede externa compartilhada para Traefik
docker network inspect web >/dev/null 2>&1 || docker network create web

# Instalar Portainer
log "Instalando Portainer..."
docker volume create portainer_data >/dev/null
docker rm -f portainer 2>/dev/null || true
docker run -d --name portainer --restart unless-stopped \
  -p 8000:8000 -p 9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest

# Traefik stack
log "Subindo Traefik (reverse proxy + Let's Encrypt)..."
TRAEFIK_DIR="/opt/traefik"
mkdir -p "$TRAEFIK_DIR"
cat > "$TRAEFIK_DIR/traefik.yml" <<EOF
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
certificatesResolvers:
  letsencrypt:
    acme:
      email: "$ACME_EMAIL"
      storage: "/etc/traefik/acme/acme.json"
      httpChallenge:
        entryPoint: web
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
api:
  dashboard: false
EOF

cat > "$TRAEFIK_DIR/docker-compose.yml" <<'EOF'
version: "3.8"
services:
  traefik:
    image: traefik:v2.11
    container_name: traefik
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/traefik/acme/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./traefik.yml:/etc/traefik/traefik.yml:ro"
      - "./acme:/etc/traefik/acme"
    networks:
      - web
    restart: unless-stopped
networks:
  web:
    external: true
EOF
mkdir -p "$TRAEFIK_DIR/acme" && touch "$TRAEFIK_DIR/acme/acme.json" && chmod 600 "$TRAEFIK_DIR/acme/acme.json"
(cd "$TRAEFIK_DIR" && docker compose up -d)

# Build da imagem ChatNegócios a partir do repositório atual
APP_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
ENV_FILE="$APP_DIR/.env.production"
if [[ -f "$APP_DIR/.env.production" ]]; then
  ENV_FILE="$APP_DIR/.env.production"
elif [[ -f "$APP_DIR/.env" ]]; then
  ENV_FILE="$APP_DIR/.env"
elif [[ -f "$APP_DIR/.env.example" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.production"
  ENV_FILE="$APP_DIR/.env.production"
else
  cat > "$APP_DIR/.env.production" <<'EOF'
# Preencha os valores VITE_* conforme necessário
VITE_EVOLUTION_API_URL=
VITE_EVOLUTION_API_KEY=
VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE=
VITE_EVOLUTION_WEBHOOK_URL=
EOF
  ENV_FILE="$APP_DIR/.env.production"
fi
log "Construindo imagem chatnegocios:latest"
docker build -t chatnegocios:latest "$APP_DIR"

# Stack ChatNegócios
CHAT_DIR="/opt/chatnegocios"
mkdir -p "$CHAT_DIR"
cat > "$CHAT_DIR/docker-compose.yml" <<EOF
version: "3.8"
services:
  postgres-chatnegocios:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: chatnegocios
      POSTGRES_USER: chatnegocios
      POSTGRES_PASSWORD: ${CHAT_DB_PASS}
    volumes:
      - chat_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatnegocios -d chatnegocios || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks: [ web ]

  chatnegocios:
    image: chatnegocios:latest
    environment:
      PORT: 3000
      WEBHOOK_PATH: /api/evolution/webhook
      DATABASE_URL: postgres://chatnegocios:${CHAT_DB_PASS}@postgres-chatnegocios:5432/chatnegocios
    depends_on:
      postgres-chatnegocios:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chat.rule=Host(\`${CHAT_DOMAIN}\`)"
      - "traefik.http.routers.chat.entrypoints=websecure"
      - "traefik.http.routers.chat.tls.certresolver=letsencrypt"
      - "traefik.http.services.chat.loadbalancer.server.port=3000"
    restart: unless-stopped
    networks: [ web ]

networks:
  web:
    external: true

volumes:
  chat_pgdata:
EOF
(cd "$CHAT_DIR" && docker compose up -d)

# Gerar apikey Evolution (se não fornecida)
if [[ -z "$EVO_APIKEY" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    EVO_APIKEY="$(openssl rand -hex 24)"
  else
    EVO_APIKEY="$(date +%s%N | sha256sum | cut -c1-48)"
  fi
fi

# Stack Evolution
EVO_DIR="/opt/evolution"
mkdir -p "$EVO_DIR"
cat > "$EVO_DIR/docker-compose.yml" <<EOF
version: "3.8"
services:
  postgres-evolution:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: ${EVO_DB_PASS}
    volumes:
      - evo_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evolution -d evolution || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks: [ web ]

  evolution-api:
    image: ghcr.io/evolutionapi/evolution-api:latest
    environment:
      PORT: 8080
      APP_PORT: 8080
      DATABASE_URL: postgres://evolution:${EVO_DB_PASS}@postgres-evolution:5432/evolution
      MANAGER_APIKEY: ${EVO_APIKEY}
    depends_on:
      postgres-evolution:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.evo.rule=Host(\`${EVO_DOMAIN}\`)"
      - "traefik.http.routers.evo.entrypoints=websecure"
      - "traefik.http.routers.evo.tls.certresolver=letsencrypt"
      - "traefik.http.services.evo.loadbalancer.server.port=8080"
    restart: unless-stopped
    networks: [ web ]

networks:
  web:
    external: true

volumes:
  evo_pgdata:
EOF
(cd "$EVO_DIR" && docker compose up -d)

echo "\nInstalação concluída. Próximos passos:"
echo "- Aponte DNS de ${CHAT_DOMAIN} e ${EVO_DOMAIN} para o IP deste servidor."
echo "- Se usar Cloudflare, desative o proxy (nuvem laranja) durante a emissão dos certificados."
echo "- Traefik está rodando e emitirá SSL automaticamente via Let's Encrypt para os domínios."
echo "- Portainer disponível em https://<SEU_IP>:9443 — crie o usuário admin no primeiro acesso."
echo "- Stacks estão em /opt/traefik, /opt/chatnegocios e /opt/evolution."
echo "- Apikey Evolution usada: ${EVO_APIKEY} (guarde em local seguro)."
echo "\nComandos úteis:"
echo "- docker compose -f /opt/traefik/docker-compose.yml logs -f"
echo "- docker compose -f /opt/chatnegocios/docker-compose.yml logs -f"
echo "- docker compose -f /opt/evolution/docker-compose.yml logs -f"
echo "- docker ps"
echo "\nSe quiser acessar Portainer por domínio (ex.: portainer.seu-dominio.com), posso adicionar labels no Traefik para publicar o container com SSL."