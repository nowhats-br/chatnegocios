#!/usr/bin/env bash
set -euo pipefail

# ChatNegocios Installer — publica Postgres e ChatNegocios (frontend+backend)
# Uso interativo: sudo bash scripts/install-chatnegocios.sh
# Não-interativo: CHATNEGOCIOS_DOMAIN=chat.seu.domino EVOLUTION_DOMAIN=evoapi.seu.domino sudo -E bash scripts/install-chatnegocios.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN:-}
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN:-}

if [[ -z "$CHATNEGOCIOS_DOMAIN" ]]; then
  read -rp "Informe o domínio do ChatNegocios (ex: chat.seudominio.com): " CHATNEGOCIOS_DOMAIN
fi
if [[ -z "$EVOLUTION_DOMAIN" ]]; then
  read -rp "Informe o domínio da Evolution (ex: evoapi.seudominio.com): " EVOLUTION_DOMAIN
fi
if [[ -z "$CHATNEGOCIOS_DOMAIN" || -z "$EVOLUTION_DOMAIN" ]]; then
  echo "[ERRO] Domínios são obrigatórios." >&2
  exit 1
fi

CHATNEGOCIOS_API_DOMAIN="api.${CHATNEGOCIOS_DOMAIN}"

PROJECT_DIR="$(pwd)"
ENV_FILE_CHAT="${PROJECT_DIR}/.env.chatnegocios"
ENV_FILE_EVO="${PROJECT_DIR}/.env.evolution"

# Detecta a chave da Evolution a partir de .env.evolution, se existente
VITE_EVOLUTION_API_KEY=""
if [[ -f "$ENV_FILE_EVO" ]]; then
  VITE_EVOLUTION_API_KEY=$(grep '^VITE_EVOLUTION_API_KEY=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
fi
if [[ -z "$VITE_EVOLUTION_API_KEY" ]]; then
  echo "[AVISO] Não encontrei VITE_EVOLUTION_API_KEY em $ENV_FILE_EVO. O frontend será construído sem chave. Você poderá configurar URL e chave dentro do app em Configurações."
fi

echo "\n==> Escrevendo .env.chatnegocios"
cat > "$ENV_FILE_CHAT" <<EOF
# Gerado pelo install-chatnegocios.sh
CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN}
CHATNEGOCIOS_API_DOMAIN=${CHATNEGOCIOS_API_DOMAIN}
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
PORT=3001
CORS_ORIGINS=https://${CHATNEGOCIOS_DOMAIN}
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
docker compose -f "$PROJECT_DIR/scripts/postgres-compose.yml" --env-file "$ENV_FILE_CHAT" up -d

echo "\n==> Construindo backend"
docker build -t chatnegocios-backend:latest -f "$PROJECT_DIR/Dockerfile.backend" "$PROJECT_DIR"

echo "\n==> Construindo frontend com URLs/Chave"
BUILD_ARGS=(
  "--build-arg" "VITE_BACKEND_URL=https://${CHATNEGOCIOS_API_DOMAIN}"
  "--build-arg" "VITE_EVOLUTION_API_URL=https://${EVOLUTION_DOMAIN}"
)
if [[ -n "$VITE_EVOLUTION_API_KEY" ]]; then
  BUILD_ARGS+=("--build-arg" "VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY}")
fi
docker build "${BUILD_ARGS[@]}" -t chatnegocios-frontend:latest -f "$PROJECT_DIR/Dockerfile.frontend" "$PROJECT_DIR"

echo "\n==> Publicando ChatNegocios (frontend + backend)"
docker compose -f "$PROJECT_DIR/scripts/chatnegocios-compose.yml" --env-file "$ENV_FILE_CHAT" up -d --remove-orphans

echo "\n=== ChatNegocios instalado ==="
echo "Frontend: https://${CHATNEGOCIOS_DOMAIN}"
echo "Backend: https://${CHATNEGOCIOS_API_DOMAIN}"
echo "Webhook Evolution: https://${CHATNEGOCIOS_API_DOMAIN}/api/whatsapp/webhook"
if [[ -n "$VITE_EVOLUTION_API_KEY" ]]; then
  echo "Chave Evolution utilizada no frontend: ${VITE_EVOLUTION_API_KEY}"
else
  echo "Configure a URL e a chave da Evolution dentro do app (Configurações)."
fi