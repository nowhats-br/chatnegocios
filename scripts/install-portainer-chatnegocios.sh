#!/usr/bin/env bash
set -euo pipefail

# Instalador Portainer + Traefik + ChatNegocios (Swarm)
# Uso: sudo -E bash scripts/install-portainer-chatnegocios.sh
# Variáveis opcionais: CHATNEGOCIOS_DOMAIN, CHATNEGOCIOS_API_DOMAIN, ACME_EMAIL, EVOLUTION_SERVER_URL

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"

# Domínios solicitados
CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN:-chatvendas.nowhats.com.br}
CHATNEGOCIOS_API_DOMAIN=${CHATNEGOCIOS_API_DOMAIN:-brack.nowhats.com.br}
ACME_EMAIL=${ACME_EMAIL:-suporte@nowhats.com.br}
EVOLUTION_SERVER_URL=${EVOLUTION_SERVER_URL:-}

SERVER_PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$SERVER_PUBLIC_IP" ]]; then
  SERVER_PUBLIC_IP="$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d'/' -f1 | head -n1)"
fi

# Verifica Docker e plugin Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "Instalando Docker..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker || true

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] Docker Compose plugin não encontrado. Instale com: sudo apt-get install docker-compose-plugin" >&2
  exit 1
fi

# Swarm e redes
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [[ "$SWARM_STATE" != "active" ]]; then
  echo "Inicializando Docker Swarm..."
  docker swarm init || true
fi

# Redes overlay (attachable para permitir containers como Portainer)
docker network inspect chatnegocios >/dev/null 2>&1 || docker network create --driver overlay --attachable chatnegocios
APP_NET_SWARM="app_net_swarm"
docker network inspect "$APP_NET_SWARM" >/dev/null 2>&1 || docker network create --driver overlay --attachable "$APP_NET_SWARM"

# Portainer
echo "\n==> Subindo Portainer"
docker volume create portainer_data >/dev/null 2>&1 || true
if docker ps -a --format '{{.Names}}' | grep -q '^portainer$'; then
  docker rm -f portainer || true
fi
docker run -d \
  -p 8000:8000 -p 9000:9000 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  --network "$APP_NET_SWARM" \
  portainer/portainer-ce:latest

echo "Portainer: http://${SERVER_PUBLIC_IP:-SEU_SERVIDOR}:9000"

# Traefik como stack (TLS via ACME)
echo "\n==> Publicando Traefik (Let's Encrypt)"
ACME_EMAIL="$ACME_EMAIL" docker stack deploy -c "$PROJECT_DIR/scripts/traefik-compose.yml" traefik

# Registry local para Swarm puxar imagens
REGISTRY_ADDR="localhost:5000"
echo "\n==> Subindo registry local em ${REGISTRY_ADDR}"
if ! docker ps -a --format '{{.Names}}' | grep -q '^registry$'; then
  docker run -d --restart=always -p 5000:5000 --name registry registry:2
else
  docker start registry >/dev/null 2>&1 || true
fi

# Build imagens ChatNegocios
echo "\n==> Construindo imagens do ChatNegocios"
# Backend
docker build -t chatnegocios-backend:latest -f "$PROJECT_DIR/Dockerfile.backend" "$PROJECT_DIR"
# Frontend (injeta URLs de backend/evolution)
BUILD_ARGS=(
  "--build-arg" "VITE_BACKEND_URL=https://${CHATNEGOCIOS_API_DOMAIN}"
  "--build-arg" "VITE_EVOLUTION_API_URL=${EVOLUTION_SERVER_URL}"
  "--build-arg" "VITE_EVOLUTION_WEBHOOK_URL=https://${CHATNEGOCIOS_API_DOMAIN}/api/whatsapp/webhook"
)
if [[ -n "$EVOLUTION_SERVER_URL" ]]; then
  echo "Usando EVOLUTION_SERVER_URL=${EVOLUTION_SERVER_URL}"
fi

docker build "${BUILD_ARGS[@]}" -t chatnegocios-frontend:latest -f "$PROJECT_DIR/Dockerfile.frontend" "$PROJECT_DIR"

# Tag + Push no registry local
echo "\n==> Publicando imagens no registry local"
docker tag chatnegocios-backend:latest ${REGISTRY_ADDR}/chatnegocios-backend:latest
docker tag chatnegocios-frontend:latest ${REGISTRY_ADDR}/chatnegocios-frontend:latest

docker push ${REGISTRY_ADDR}/chatnegocios-backend:latest
docker push ${REGISTRY_ADDR}/chatnegocios-frontend:latest

# Postgres stack (sem publicar porta e usando rede overlay)
echo "\n==> Publicando Postgres (stack)"
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
export POSTGRES_DB=${POSTGRES_DB:-chatnegocios}

docker stack deploy -c <(sed -E \
  "s/app_net/${APP_NET_SWARM}/g; \
   /(^[[:space:]]*ports:[[:space:]]*$)|(^[[:space:]]*-[[:space:]]*\"5432:5432\"[[:space:]]*$)|(^[[:space:]]*container_name:.*$)|(^[[:space:]]*restart:.*$)/d" \
  "$PROJECT_DIR/scripts/postgres-compose.yml") chatdb

# ChatNegocios como stack (usando redes overlay e imagens do registry)
echo "\n==> Publicando ChatNegocios (frontend + backend) como stack"
export CHATNEGOCIOS_DOMAIN="$CHATNEGOCIOS_DOMAIN"
export CHATNEGOCIOS_API_DOMAIN="$CHATNEGOCIOS_API_DOMAIN"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
export CORS_ORIGINS="https://${CHATNEGOCIOS_DOMAIN}"

docker stack deploy -c <(sed -E \
  "s/app_net/${APP_NET_SWARM}/g; \
   /(^[[:space:]]*ports:[[:space:]]*$)|(^[[:space:]]*-[[:space:]]*\"3001:3001\"[[:space:]]*$)|(^[[:space:]]*-[[:space:]]*\"8081:80\"[[:space:]]*$)|(^[[:space:]]*container_name:.*$)|(^[[:space:]]*restart:.*$)/d; \
   s~image:[[:space:]]*chatnegocios-backend:latest~image: ${REGISTRY_ADDR}/chatnegocios-backend:latest~; \
   s~image:[[:space:]]*chatnegocios-frontend:latest~image: ${REGISTRY_ADDR}/chatnegocios-frontend:latest~" \
  "$PROJECT_DIR/scripts/chatnegocios-compose.yml") chatnegocios

# Status
echo "\n==> Serviços (esperado 1/1 para cada)"
docker service ls

echo "\n=== Instalação concluída ==="
echo "Frontend: https://${CHATNEGOCIOS_DOMAIN}"
echo "Backend:  https://${CHATNEGOCIOS_API_DOMAIN}"
echo "Webhook:  https://${CHATNEGOCIOS_API_DOMAIN}/api/whatsapp/webhook"
echo "Portainer: http://${SERVER_PUBLIC_IP:-SEU_SERVIDOR}:9000"