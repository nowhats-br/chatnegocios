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

if [[ -z "$CHATNEGOCIOS_DOMAIN" ]]; then
  read -rp "Informe o domínio do ChatNegocios (ex: chat.seudominio.com): " CHATNEGOCIOS_DOMAIN
fi
if [[ -z "$CHATNEGOCIOS_DOMAIN" ]]; then
  echo "[ERRO] Domínio do ChatNegocios é obrigatório." >&2
  exit 1
fi

CHATNEGOCIOS_API_DOMAIN="api.${CHATNEGOCIOS_DOMAIN}"

# Valida resolução DNS (chat e api.chat)
if ! getent hosts "$CHATNEGOCIOS_DOMAIN" >/dev/null 2>&1; then
  echo "[ERRO] O domínio '$CHATNEGOCIOS_DOMAIN' não resolve para nenhum IP neste servidor." >&2
  echo "       Crie um registro A/AAAA apontando para o IP do servidor e tente novamente." >&2
  exit 1
fi
if ! getent hosts "$CHATNEGOCIOS_API_DOMAIN" >/dev/null 2>&1; then
  echo "[AVISO] O subdomínio '$CHATNEGOCIOS_API_DOMAIN' não resolve." >&2
  echo "        Recomenda-se criar um CNAME 'api' apontando para '$CHATNEGOCIOS_DOMAIN' ou um A/AAAA próprio." >&2
  echo "        O deploy seguirá, mas o Traefik só roteará quando o DNS estiver correto." >&2
fi

PROJECT_DIR="$(pwd)"
ENV_FILE_CHAT="${PROJECT_DIR}/.env.chatnegocios"
ENV_FILE_EVO="${PROJECT_DIR}/.env.evolution"

# Carrega domínio e chave da Evolution a partir de .env.evolution
if [[ ! -f "$ENV_FILE_EVO" ]]; then
  echo "[ERRO] .env.evolution não encontrado. Execute primeiro: EVOLUTION_DOMAIN=seu.dominio sudo -E bash scripts/install-evolution.sh" >&2
  exit 1
fi
EVOLUTION_DOMAIN=$(grep '^EVOLUTION_DOMAIN=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
VITE_EVOLUTION_API_KEY=$(grep '^VITE_EVOLUTION_API_KEY=' "$ENV_FILE_EVO" | head -n1 | cut -d'=' -f2 || true)
if [[ -z "$EVOLUTION_DOMAIN" ]]; then
  echo "[ERRO] EVOLUTION_DOMAIN não definido em $ENV_FILE_EVO. Reinstale a Evolution com domínio válido." >&2
  exit 1
fi
if [[ -z "$VITE_EVOLUTION_API_KEY" ]]; then
  echo "[AVISO] VITE_EVOLUTION_API_KEY não definido em $ENV_FILE_EVO. O frontend será construído sem chave; você poderá configurá-la dentro do app em Configurações."
fi

# Verifica Docker Compose plugin
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] Docker Compose plugin não encontrado. Instale com: sudo apt-get install docker-compose-plugin" >&2
  exit 1
fi

# Garante redes Docker
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net

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

echo "\n==> Construindo frontend com URLs/Chave (não altera Evolution)"
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