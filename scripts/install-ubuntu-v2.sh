#!/usr/bin/env bash
set -euo pipefail

# ChatNegocios — Instalador automático para Ubuntu (Docker + Traefik + Postgres + Evolution)
# Suporta retomada (--resume), sobrescrita forçada (--force) e pular build (--skip-build)

FORCE=false
RESUME=false
SKIP_BUILD=false
NONINTERACTIVE=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --resume) RESUME=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --yes|--non-interactive) NONINTERACTIVE=true ;;
  esac
done

STATE_FILE=".install.state"
touch "$STATE_FILE"

mark_done() {
  local step="$1"
  grep -q "^${step}=done$" "$STATE_FILE" || echo "${step}=done" >> "$STATE_FILE"
}

is_done() {
  local step="$1"
  grep -q "^${step}=done$" "$STATE_FILE" 2>/dev/null
}

should_run() {
  local step="$1"
  if [ "$FORCE" = true ]; then return 0; fi
  if [ "$RESUME" = true ] && is_done "$step"; then return 1; fi
  return 0
}

prompt_action() {
  local target="$1" # ex.: "container traefik"
  if [ "$FORCE" = true ]; then echo overwrite; return 0; fi
  if [ "$RESUME" = true ] || [ "$NONINTERACTIVE" = true ]; then echo skip; return 0; fi
  read -rp "[PROMPT] Encontrado $target. Sobrescrever (s) ou pular (p)? [s/p]: " ans
  case "$ans" in
    s|S) echo overwrite ;;
    *) echo skip ;;
  esac
}

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
if [ -f .env.deploy ]; then
  CHATNEGOCIOS_DOMAIN=$(grep -E '^CHATNEGOCIOS_DOMAIN=' .env.deploy | head -n1 | awk -F= '{print $2}')
  CHATNEGOCIOS_API_DOMAIN=$(grep -E '^CHATNEGOCIOS_API_DOMAIN=' .env.deploy | head -n1 | awk -F= '{print $2}')
  EVOLUTION_DOMAIN=$(grep -E '^EVOLUTION_DOMAIN=' .env.deploy | head -n1 | awk -F= '{print $2}')
  ACME_EMAIL=$(grep -E '^ACME_EMAIL=' .env.deploy | head -n1 | awk -F= '{print $2}')
fi
if [ -z "${CHATNEGOCIOS_DOMAIN:-}" ]; then read -rp "Dominio do ChatNegocios (frontend, ex: chatnegocios.seudominio.com): " CHATNEGOCIOS_DOMAIN; fi
if [ -z "${CHATNEGOCIOS_API_DOMAIN:-}" ]; then read -rp "Dominio do ChatNegocios API (backend, ex: api.seudominio.com): " CHATNEGOCIOS_API_DOMAIN; fi
if [ -z "${EVOLUTION_DOMAIN:-}" ]; then read -rp "Dominio da Evolution API (ex: evolution.seudominio.com): " EVOLUTION_DOMAIN; fi
if [ -z "${ACME_EMAIL:-}" ]; then read -rp "Email para Let's Encrypt (ACME): " ACME_EMAIL; fi

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
if [ -f .env.deploy ] && [ -z "$EVOLUTION_API_KEY" ]; then
  EVOLUTION_API_KEY=$(grep -E '^VITE_EVOLUTION_API_KEY=' .env.deploy | head -n1 | awk -F= '{print $2}')
fi
if [ -z "$EVOLUTION_API_KEY" ]; then
  echo "[INFO] Gerando VITE_EVOLUTION_API_KEY aleatória"
  EVOLUTION_API_KEY=$(openssl rand -hex 32)
fi

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

if should_run networks; then
  echo "[INFO] Criando redes Docker compartilhadas (proxy, app_net)"
  docker network create proxy >/dev/null 2>&1 || true
  docker network create app_net >/dev/null 2>&1 || true
  mark_done networks
else
  echo "[INFO] (resume) Redes já configuradas, seguindo"
fi

if should_run portainer; then
  echo "[INFO] Subindo Portainer (UI de gerenciamento)"
  docker volume create portainer_data >/dev/null 2>&1 || true
  if docker ps -a --format '{{.Names}}' | grep -q '^portainer$'; then
    action=$(prompt_action "container portainer")
    if [ "$action" = overwrite ]; then
      docker rm -f portainer >/dev/null 2>&1 || true
    else
      echo "[INFO] (skip) Portainer existente mantido"
    fi
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -q '^portainer$'; then
    docker run -d -p 9000:9000 --name portainer --restart=always \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v portainer_data:/data \
      portainer/portainer-ce:latest >/dev/null
  else
    docker start portainer >/dev/null || true
  fi
  mark_done portainer
else
  echo "[INFO] (resume) Portainer já configurado, seguindo"
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

if should_run build; then
  if [ "$SKIP_BUILD" = true ]; then
    echo "[INFO] Pulando build de imagens por solicitação (--skip-build)"
  else
    echo "[INFO] Construindo imagens do backend e frontend"
    docker build -t chatnegocios-backend:latest -f Dockerfile.backend .
    docker build \
      --build-arg VITE_BACKEND_URL=https://$CHATNEGOCIOS_API_DOMAIN \
      --build-arg VITE_EVOLUTION_API_URL=https://$EVOLUTION_DOMAIN \
      --build-arg VITE_EVOLUTION_API_KEY=$EVOLUTION_API_KEY \
      -t chatnegocios-frontend:latest \
      -f Dockerfile.frontend .
  fi
  mark_done build
else
  echo "[INFO] (resume) Build já realizado, seguindo"
fi

if should_run traefik; then
  echo "[INFO] Publicando Traefik com Let's Encrypt"
  if docker ps -a --format '{{.Names}}' | grep -q '^traefik$'; then
    action=$(prompt_action "container traefik")
    if [ "$action" = overwrite ]; then remove_container_if_exists traefik; else echo "[INFO] (skip) Mantendo traefik existente"; fi
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -q '^traefik$'; then
    docker compose -f scripts/traefik-compose.yml --env-file "$ENV_FILE" up -d
  fi
  mark_done traefik
else
  echo "[INFO] (resume) Traefik já publicado, seguindo"
fi

if should_run postgres; then
  echo "[INFO] Publicando Postgres"
  if docker ps -a --format '{{.Names}}' | grep -q '^postgres$'; then
    action=$(prompt_action "container postgres")
    if [ "$action" = overwrite ]; then remove_container_if_exists postgres; else echo "[INFO] (skip) Mantendo postgres existente"; fi
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -q '^postgres$'; then
    docker compose -f scripts/postgres-compose.yml --env-file "$ENV_FILE" up -d
  fi
  mark_done postgres
else
  echo "[INFO] (resume) Postgres já publicado, seguindo"
fi

if should_run evolution; then
  echo "[INFO] Publicando Evolution API"
  if docker ps -a --format '{{.Names}}' | grep -q '^evolution_api$'; then
    action=$(prompt_action "container evolution_api")
    if [ "$action" = overwrite ]; then remove_container_if_exists evolution_api; else echo "[INFO] (skip) Mantendo evolution_api existente"; fi
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -q '^evolution_api$'; then
    docker compose -f scripts/evolution-compose.yml --env-file "$ENV_FILE" up -d
  fi
  mark_done evolution
else
  echo "[INFO] (resume) Evolution já publicada, seguindo"
fi

if should_run chatnegocios; then
  echo "[INFO] Publicando ChatNegocios"
  for svc in chatnegocios_backend chatnegocios_frontend; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${svc}$"; then
      action=$(prompt_action "container ${svc}")
      if [ "$action" = overwrite ]; then remove_container_if_exists "$svc"; fi
    fi
  done
  if ! docker ps -a --format '{{.Names}}' | grep -q '^chatnegocios_backend$'; then
    docker compose -f scripts/chatnegocios-compose.yml --env-file "$ENV_FILE" up -d
  else
    echo "[INFO] (skip) ChatNegocios já existente — etapa mantida"
  fi
  mark_done chatnegocios
else
  echo "[INFO] (resume) ChatNegocios já publicado, seguindo"
fi

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