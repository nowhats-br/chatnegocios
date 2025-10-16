#!/usr/bin/env bash
set -euo pipefail

# ChatNegocios Installer (clean) — instala Portainer, Traefik e publica stacks:
# - Solicita: domínio ChatNegocios, e-mail SSL (ACME), domínio Evolution
# - Cria redes, sobe Portainer, Traefik, Postgres
# - Constrói imagens e publica Evolution API e ChatNegocios (frontend+backend)
# - Imprime public key da Evolution e URL de webhook ao final

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

echo "=== ChatNegocios Installer (clean) ==="
echo "Este instalador configura Portainer + Traefik e publica ChatNegocios e Evolution."
echo "Certifique-se de ter DNS apontando para seu servidor, e portas 80/443 abertas."
echo

read -rp "Informe o domínio do ChatNegocios (ex: chat.seudominio.com): " CHATNEGOCIOS_DOMAIN
read -rp "Informe o e-mail para SSL (ACME/Let's Encrypt): " ACME_EMAIL
read -rp "Informe o domínio da Evolution API (ex: evolution.seudominio.com): " EVOLUTION_DOMAIN

if [[ -z "$CHATNEGOCIOS_DOMAIN" || -z "$ACME_EMAIL" || -z "$EVOLUTION_DOMAIN" ]]; then
  echo "[ERRO] Todos os campos são obrigatórios." >&2
  exit 1
fi

CHATNEGOCIOS_API_DOMAIN="api.${CHATNEGOCIOS_DOMAIN}"
EVOLUTION_API_KEY="$(openssl rand -hex 24)"

PROJECT_DIR="$(pwd)"
ENV_FILE="${PROJECT_DIR}/.env.deploy"

echo "\n==> Verificando/instalando Docker e Compose"
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

echo "\n==> Criando redes Docker (proxy, app_net)"
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net

echo "\n==> Escrevendo .env.deploy com variáveis necessárias"
cat > "$ENV_FILE" <<EOF
# Gerado pelo install-clean.sh
ACME_EMAIL=${ACME_EMAIL}
CHATNEGOCIOS_DOMAIN=${CHATNEGOCIOS_DOMAIN}
CHATNEGOCIOS_API_DOMAIN=${CHATNEGOCIOS_API_DOMAIN}
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
VITE_EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
# Backend
PORT=3001
CORS_ORIGINS=https://${CHATNEGOCIOS_DOMAIN}
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chatnegocios
# Postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chatnegocios
EOF

echo "\n==> Removendo containers conflitantes (se existirem)"
for c in traefik portainer postgres evolution_api chatnegocios_backend chatnegocios_frontend; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
    echo "Parando/removendo ${c}..."
    docker rm -f "${c}" || true
  fi
done

echo "\n==> Subindo Portainer"
docker volume create portainer_data >/dev/null 2>&1 || true
docker run -d \
  -p 8000:8000 -p 9000:9000 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  --network proxy \
  portainer/portainer-ce:latest

echo "\n==> Publicando Traefik (com Let's Encrypt)"
docker compose -f "$PROJECT_DIR/scripts/traefik-compose.yml" --env-file "$ENV_FILE" up -d

echo "\n==> Publicando Postgres"
docker compose -f "$PROJECT_DIR/scripts/postgres-compose.yml" --env-file "$ENV_FILE" up -d

echo "\n==> Construindo imagens do ChatNegocios (backend e frontend)"
docker build -t chatnegocios-backend:latest -f "$PROJECT_DIR/Dockerfile.backend" "$PROJECT_DIR"
docker build \
  --build-arg VITE_BACKEND_URL="https://${CHATNEGOCIOS_API_DOMAIN}" \
  --build-arg VITE_EVOLUTION_API_URL="https://${EVOLUTION_DOMAIN}" \
  --build-arg VITE_EVOLUTION_API_KEY="${EVOLUTION_API_KEY}" \
  -t chatnegocios-frontend:latest -f "$PROJECT_DIR/Dockerfile.frontend" "$PROJECT_DIR"

echo "\n==> Publicando Evolution API"
docker compose -f "$PROJECT_DIR/scripts/evolution-compose.yml" --env-file "$ENV_FILE" up -d --remove-orphans

echo "\n==> Publicando ChatNegocios (frontend + backend)"
docker compose -f "$PROJECT_DIR/scripts/chatnegocios-compose.yml" --env-file "$ENV_FILE" up -d --remove-orphans

echo "\n=== Instalação concluída ==="
echo "ChatNegocios (frontend): https://${CHATNEGOCIOS_DOMAIN}"
echo "ChatNegocios API (backend): https://${CHATNEGOCIOS_API_DOMAIN}"
echo "Evolution API: https://${EVOLUTION_DOMAIN}"
echo "Evolution Public Key (apikey): ${EVOLUTION_API_KEY}"
echo "Webhook para configurar na Evolution: https://${CHATNEGOCIOS_API_DOMAIN}/api/whatsapp/webhook"
echo
echo "Dicas:"
echo "- Acesse Portainer em http://SEU_SERVIDOR:9000 para visualizar containers/stacks."
echo "- Verifique logs com: docker logs -f traefik | docker logs -f chatnegocios_backend | docker logs -f evolution_api"
echo "- Certifique-se que DNS de ${CHATNEGOCIOS_DOMAIN} e ${EVOLUTION_DOMAIN} apontam para este servidor."
echo "- Portas 80/443 devem estar liberadas para emissão de certificados SSL."