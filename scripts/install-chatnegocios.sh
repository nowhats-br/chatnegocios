#!/usr/bin/env bash
set -euo pipefail

# ChatNegocios Installer — publica Postgres e ChatNegocios (frontend+backend)
# Uso interativo: sudo bash scripts/install-chatnegocios.sh
# Não-interativo: CHATNEGOCIOS_DOMAIN=chat.seu.domino EVOLUTION_SERVER_URL=https://evoapi.seu.domino VITE_EVOLUTION_API_KEY=sua_chave sudo -E bash scripts/install-chatnegocios.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN:-}

if [[ -z "$CHATNEGOCIOS_DOMAIN" ]]; then
  read -rp "Informe o domínio do ChatNegocios (ex: chat.seudominio.com): " CHATNEGOCIOS_DOMAIN
fi
if [[ -z "$CHATNEGOCIOS_DOMAIN" ]]; then
  echo "[ERRO] Domínio do ChatNegocios é obrigatório." >&2
  exit 1
fi

CHATNEGOCIOS_API_DOMAIN="api.${CHATNEGOCIOS_DOMAIN}"
SERVER_PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$SERVER_PUBLIC_IP" ]]; then
  SERVER_PUBLIC_IP="$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d'/' -f1 | head -n1)"
fi

# Valida resolução DNS (chat e api.chat)
if ! getent hosts "$CHATNEGOCIOS_DOMAIN" >/dev/null 2>&1; then
  echo "[ERRO] O domínio '$CHATNEGOCIOS_DOMAIN' não resolve para nenhum IP neste servidor." >&2
  echo "       Crie um registro A/AAAA apontando para o IP do servidor e tente novamente." >&2
  exit 1
fi
if ! getent hosts "$CHATNEGOCIOS_API_DOMAIN" >/dev/null 2>&1; then
  echo "[AVISO] O subdomínio '$CHATNEGOCIOS_API_DOMAIN' não resolve." >&2
  echo "        O deploy seguirá, mas o Traefik só roteará quando o DNS estiver correto." >&2
fi

PROJECT_DIR="$(pwd)"
ENV_FILE_CHAT="${PROJECT_DIR}/.env.chatnegocios"
ENV_FILE_EVO="${PROJECT_DIR}/.env.evolution"

# Permite Evolution externa via variáveis EVOLUTION_SERVER_URL e VITE_EVOLUTION_API_KEY
EVOLUTION_SERVER_URL_INPUT="${EVOLUTION_SERVER_URL:-}"
VITE_EVOLUTION_API_KEY_INPUT="${VITE_EVOLUTION_API_KEY:-}"

EVOLUTION_DOMAIN=""
VITE_EVOLUTION_API_KEY="$VITE_EVOLUTION_API_KEY_INPUT"
SERVER_URL="$EVOLUTION_SERVER_URL_INPUT"

# Se .env.evolution existir, usa como fonte padrão
if [[ -f "$ENV_FILE_EVO" ]]; then
  EVOLUTION_DOMAIN=$(grep '^EVOLUTION_DOMAIN=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
  if [[ -z "$VITE_EVOLUTION_API_KEY" ]]; then
    VITE_EVOLUTION_API_KEY=$(grep '^VITE_EVOLUTION_API_KEY=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
  fi
  if [[ -z "$SERVER_URL" ]]; then
    SERVER_URL=$(grep '^SERVER_URL=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
  fi
fi

# Solicita URL da Evolution se ainda não obtida
if [[ -z "$SERVER_URL" ]]; then
  read -rp "Informe a URL da Evolution (ex: https://evolution.seudominio.com): " SERVER_URL
fi
if [[ -z "$SERVER_URL" ]]; then
  echo "[ERRO] URL da Evolution é obrigatória. Defina EVOLUTION_SERVER_URL ou forneça via prompt." >&2
  exit 1
fi

if [[ -z "$VITE_EVOLUTION_API_KEY" ]]; then
  echo "[AVISO] VITE_EVOLUTION_API_KEY não informado. O frontend será construído sem chave; você poderá configurá-la dentro do app em Configurações."
fi

# Verifica Docker Compose plugin
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] Docker Compose plugin não encontrado. Instale com: sudo apt-get install docker-compose-plugin" >&2
  exit 1
fi

# Garante redes Docker
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net
# Garante rede de proxy conforme ambiente
# (usando nome 'chatnegocios' informado pelo usuário)
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [[ "$SWARM_STATE" == "active" ]]; then
  if docker network inspect chatnegocios >/dev/null 2>&1; then
    ATTACHABLE=$(docker network inspect chatnegocios -f '{{.Attachable}}' 2>/dev/null || echo "unknown")
    if [[ "$ATTACHABLE" != "true" ]]; then
      if [[ "${FORCE_RECREATE_NETWORK:-0}" == "1" ]]; then
        echo "[INFO] Rede 'chatnegocios' existente com attachable=false. Recriando como overlay --attachable..."
        docker network rm chatnegocios || true
        docker network create --driver overlay --attachable chatnegocios
      else
        echo "[ERRO] A rede 'chatnegocios' (overlay) está com attachable=false."
        echo "       Contêineres Docker não conseguem se anexar. Recrie a rede com:"
        echo "       docker network rm chatnegocios && docker network create -d overlay --attachable chatnegocios"
        echo "       (Se estiver em uso por stacks, remova-os antes em Portainer ou com docker stack rm)"
        exit 1
      fi
    fi
  else
    docker network create --driver overlay --attachable chatnegocios
  fi
else
  docker network inspect chatnegocios >/dev/null 2>&1 || docker network create chatnegocios
fi

# Detecta proxy (Traefik ou Nginx); se não estiver rodando, usa URLs HTTP por IP:porta
USE_PROXY=0
if docker ps --format '{{.Names}}' | grep -q '^traefik$' || docker ps --format '{{.Names}}' | grep -q '^nginx-proxy$'; then
  USE_PROXY=1
fi

if [[ "$USE_PROXY" -eq 1 ]]; then
  BACKEND_URL="https://${CHATNEGOCIOS_API_DOMAIN}"
  FRONTEND_ORIGIN="https://${CHATNEGOCIOS_DOMAIN}"
else
  BACKEND_URL="http://${SERVER_PUBLIC_IP}:3001"
  FRONTEND_ORIGIN="http://${SERVER_PUBLIC_IP}:8081"
fi

echo "\n==> Escrevendo .env.chatnegocios"
cat > "$ENV_FILE_CHAT" <<EOF
# Gerado pelo install-chatnegocios.sh
CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN}
CHATNEGOCIOS_API_DOMAIN=${CHATNEGOCIOS_API_DOMAIN}
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
EVOLUTION_SERVER_URL=${SERVER_URL}
PORT=3001
CORS_ORIGINS=${FRONTEND_ORIGIN}
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chatnegocios
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chatnegocios
EOF

echo "\n==> Removendo possíveis containers antigos"
for c in chatnegocios_backend chatnegocios_frontend postgres; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
    echo "Parando/removendo ${c}..." && docker rm -f "${c}" || true
  fi
done

echo "\n==> Publicando Postgres"

echo "\n==> Construindo backend"
docker build -t chatnegocios-backend:latest -f "$PROJECT_DIR/Dockerfile.backend" "$PROJECT_DIR"

echo "\n==> Construindo frontend com URLs/Chave (não altera Evolution)"
BUILD_ARGS=(
  "--build-arg" "VITE_BACKEND_URL=${BACKEND_URL}"
  "--build-arg" "VITE_EVOLUTION_API_URL=${SERVER_URL}"
  "--build-arg" "VITE_EVOLUTION_WEBHOOK_URL=${BACKEND_URL}/api/whatsapp/webhook"
)
if [[ -n "$VITE_EVOLUTION_API_KEY" ]]; then
  BUILD_ARGS+=("--build-arg" "VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY}")
fi
docker build "${BUILD_ARGS[@]}" -t chatnegocios-frontend:latest -f "$PROJECT_DIR/Dockerfile.frontend" "$PROJECT_DIR"

echo "\n==> Publicando ChatNegocios (frontend + backend)"
docker compose -f "$PROJECT_DIR/scripts/chatnegocios-compose.yml" --env-file "$ENV_FILE_CHAT" up -d --remove-orphans

echo "\n=== ChatNegocios instalado ==="
if [[ "$USE_PROXY" -eq 1 ]]; then
  echo "Frontend: https://${CHATNEGOCIOS_DOMAIN}"
  echo "Backend: https://${CHATNEGOCIOS_API_DOMAIN}"
  echo "Webhook Evolution: https://${CHATNEGOCIOS_API_DOMAIN}/api/whatsapp/webhook"
else
  echo "Frontend: ${FRONTEND_ORIGIN}"
  echo "Backend: ${BACKEND_URL}"
  echo "Webhook Evolution: ${BACKEND_URL}/api/whatsapp/webhook"
fi
if [[ -n "$VITE_EVOLUTION_API_KEY" ]]; then
  echo "Chave Evolution utilizada no frontend: ${VITE_EVOLUTION_API_KEY}"
else
  echo "Configure a URL e a chave da Evolution dentro do app (Configurações)."
fi