#!/usr/bin/env bash
set -euo pipefail

# ChatNegocios — Instalador automático para Ubuntu (Docker + Traefik + Postgres + Evolution)
# - Instala Docker (se necessário)
# - Sobe Portainer
# - Cria redes compartilhadas
# - Constrói imagens do backend e frontend
# - Publica Traefik com Let's Encrypt (ACME) usando HTTP challenge
# - Publica Postgres, Evolution API e ChatNegocios com domínios e SSL

ensure_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[INFO] Instalando dependência: $1"
    sudo apt-get update -y
    case "$1" in
      docker)
        sudo apt-get install -y ca-certificates curl gnupg lsb-release
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
        sudo apt-get update -y
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        sudo systemctl enable --now docker || true
        ;;
      openssl)
        sudo apt-get install -y openssl
        ;;
      *)
        sudo apt-get install -y "$1"
        ;;
    esac
  fi
}

echo "[INFO] Verificando dependências..."
ensure_cmd docker
ensure_cmd openssl

echo "[INFO] Verificando 'docker compose' plugin..."
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] Docker Compose plugin não encontrado. Instale com: sudo apt-get install docker-compose-plugin"
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_DIR"

remove_container_if_exists() {
  local name="$1"
  if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    echo "[WARN] Removendo container existente em conflito: ${name}"
    docker rm -f "${name}" >/dev/null 2>&1 || true
  fi
}

echo "[INFO] Coletando informações de instalação"
read -rp "Dominio do ChatNegocios (frontend, ex: chatnegocios.seudominio.com): " CHATNEGOCIOS_DOMAIN
read -rp "Dominio do ChatNegocios API (backend, ex: api.seudominio.com): " CHATNEGOCIOS_API_DOMAIN
read -rp "Dominio da Evolution API (ex: evolution.seudominio.com): " EVOLUTION_DOMAIN
read -rp "Email para Let's Encrypt (ACME): " ACME_EMAIL

POSTGRES_USER_DEFAULT="postgres"
POSTGRES_PASSWORD_DEFAULT="postgres"
POSTGRES_DB_DEFAULT="chatnegocios"
read -rp "Postgres USER [${POSTGRES_USER_DEFAULT}]: " POSTGRES_USER || true
POSTGRES_USER=${POSTGRES_USER:-$POSTGRES_USER_DEFAULT}
read -rp "Postgres PASSWORD [${POSTGRES_PASSWORD_DEFAULT}]: " POSTGRES_PASSWORD || true
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$POSTGRES_PASSWORD_DEFAULT}
read -rp "Postgres DB [${POSTGRES_DB_DEFAULT}]: " POSTGRES_DB || true
POSTGRES_DB=${POSTGRES_DB:-$POSTGRES_DB_DEFAULT}

EVOLUTION_API_KEY=""
if [ -f .env ]; then
  EVOLUTION_API_KEY=$(grep -E '^\s*VITE_EVOLUTION_API_KEY\s*=' .env | head -n1 | awk -F= '{print $2}' | tr -d '[:space:]')
fi
if [ -z "$EVOLUTION_API_KEY" ]; then
  echo "[INFO] Gerando VITE_EVOLUTION_API_KEY aleatória"
  EVOLUTION_API_KEY=$(openssl rand -hex 32)
fi

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

echo "[INFO] Criando redes Docker compartilhadas (proxy, app_net)"
docker network create proxy >/dev/null 2>&1 || true
docker network create app_net >/dev/null 2>&1 || true

echo "[INFO] Subindo Portainer (UI de gerenciamento)"
docker volume create portainer_data >/dev/null 2>&1 || true
if ! docker ps -a --format '{{.Names}}' | grep -q '^portainer$'; then
  docker run -d -p 9000:9000 --name portainer --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest >/dev/null
else
  docker start portainer >/dev/null || true
fi

ENV_FILE=".env.deploy"
cat > "$ENV_FILE" <<EOF
ACME_EMAIL=$ACME_EMAIL
EVOLUTION_DOMAIN=$EVOLUTION_DOMAIN
CHATNEGOCIOS_DOMAIN=$CHATNEGOCIOS_DOMAIN
CHATNEGOCIOS_API_DOMAIN=$CHATNEGOCIOS_API_DOMAIN
VITE_EVOLUTION_API_KEY=$EVOLUTION_API_KEY
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB
DATABASE_URL=$DATABASE_URL
EOF

echo "[INFO] Construindo imagens do backend e frontend"
docker build -t chatnegocios-backend:latest -f Dockerfile.backend .
docker build \
  --build-arg VITE_BACKEND_URL=https://$CHATNEGOCIOS_API_DOMAIN \
  --build-arg VITE_EVOLUTION_API_URL=https://$EVOLUTION_DOMAIN \
  --build-arg VITE_EVOLUTION_API_KEY=$EVOLUTION_API_KEY \
  -t chatnegocios-frontend:latest \
  -f Dockerfile.frontend .

echo "[INFO] Publicando Traefik com Let's Encrypt"
remove_container_if_exists traefik
docker compose -f scripts/traefik-compose.yml --env-file "$ENV_FILE" up -d

echo "[INFO] Publicando Postgres"
remove_container_if_exists postgres
docker compose -f scripts/postgres-compose.yml --env-file "$ENV_FILE" up -d

echo "[INFO] Publicando Evolution API"
remove_container_if_exists evolution_api
docker compose -f scripts/evolution-compose.yml --env-file "$ENV_FILE" up -d

echo "[INFO] Publicando ChatNegocios"
remove_container_if_exists chatnegocios_backend
remove_container_if_exists chatnegocios_frontend
docker compose -f scripts/chatnegocios-compose.yml --env-file "$ENV_FILE" up -d

echo
echo "[SUCESSO] Instalação concluída"
echo "Acesse Portainer:   http://$(hostname -I | awk '{print $1}'):9000"
echo "ChatNegocios (Web): https://$CHATNEGOCIOS_DOMAIN"
echo "ChatNegocios (API): https://$CHATNEGOCIOS_API_DOMAIN"
echo "Evolution API:      https://$EVOLUTION_DOMAIN"
echo
echo "Observações:"
echo "- A resolução dos domínios deve apontar para o IP público deste servidor."
echo "- Certificados Let's Encrypt exigem portas 80/443 abertas até este host."
echo "- O desafio HTTP é respondido pelo Traefik na porta 80 automaticamente."
echo "- Se desejar alterar variáveis, edite $ENV_FILE e execute novamente os compose up."