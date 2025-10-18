#!/usr/bin/env bash
set -euo pipefail

# Evolution Installer — publica Evolution API com suporte a domínio/HTTPS (Traefik opcional)
# Uso sem domínio (HTTP): sudo bash scripts/install-evolution.sh
# Uso com domínio (HTTPS via Traefik): EVOLUTION_DOMAIN=api.seu.domino sudo -E bash scripts/install-evolution.sh
# Opcional: VITE_EVOLUTION_API_KEY=chaveexistente sudo -E bash scripts/install-evolution.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN:-}
VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY:-}
EVOLUTION_VERSION=${EVOLUTION_VERSION:-2.3.5}
EVOLUTION_SOURCE_REPO=${EVOLUTION_SOURCE_REPO:-https://github.com/EvolutionAPI/evolution-api.git}

TRAEFIK_ENABLE=${TRAEFIK_ENABLE:-}
if [[ -n "$EVOLUTION_DOMAIN" ]]; then
  TRAEFIK_ENABLE=${TRAEFIK_ENABLE:-true}
  # Valida resolução DNS para evitar falhas de emissão de certificado
  if ! getent hosts "$EVOLUTION_DOMAIN" >/dev/null 2>&1; then
    echo "[ERRO] O domínio '$EVOLUTION_DOMAIN' não resolve para nenhum IP neste servidor." >&2
    echo "       Crie um registro A/AAAA apontando para o IP do servidor e tente novamente." >&2
    exit 1
  fi
else
  TRAEFIK_ENABLE=${TRAEFIK_ENABLE:-false}
  echo "[INFO] EVOLUTION_DOMAIN não informado. Deploy seguirá sem Traefik, usando acesso por IP:8080."
fi

# Verifica Docker Compose plugin
if ! docker compose version >/dev/null 2>&1; then
  echo "[ERRO] Docker Compose plugin não encontrado. Instale com: sudo apt-get install docker-compose-plugin" >&2
  exit 1
fi

if [[ -z "$VITE_EVOLUTION_API_KEY" ]]; then
  VITE_EVOLUTION_API_KEY="$(openssl rand -hex 24)"
fi

PROJECT_DIR="$(pwd)"
ENV_FILE_EVO="${PROJECT_DIR}/.env.evolution"
EVOLUTION_IMAGE_DEFAULT="atendai/evolution-api:${EVOLUTION_VERSION}"
EVOLUTION_IMAGE_LOCAL="evolution-api:${EVOLUTION_VERSION}"
EVOLUTION_IMAGE="${EVOLUTION_IMAGE_DEFAULT}"
SERVER_PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$SERVER_PUBLIC_IP" ]]; then
  SERVER_PUBLIC_IP="$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d'/' -f1 | head -n1)"
fi

echo "\n==> Preparando build opcional da Evolution a partir do Git (v${EVOLUTION_VERSION})"
if command -v git >/dev/null 2>&1; then
  WORKDIR_SRC="${PROJECT_DIR}/.evolution-src"
  mkdir -p "$WORKDIR_SRC"
  if [[ ! -d "${WORKDIR_SRC}/.git" ]]; then
    echo "Clonando ${EVOLUTION_SOURCE_REPO} em ${WORKDIR_SRC}"
    git clone --depth=1 "${EVOLUTION_SOURCE_REPO}" "${WORKDIR_SRC}" || true
  fi
  cd "${WORKDIR_SRC}"
  # Tenta checkout para tag vX.Y.Z; se não existir, tenta sem prefixo 'v'
  if git fetch --tags >/dev/null 2>&1 && git rev-parse "v${EVOLUTION_VERSION}" >/dev/null 2>&1; then
    git checkout -f "v${EVOLUTION_VERSION}" || true
  elif git rev-parse "${EVOLUTION_VERSION}" >/dev/null 2>&1; then
    git checkout -f "${EVOLUTION_VERSION}" || true
  else
    echo "[AVISO] Tag/branch ${EVOLUTION_VERSION} não encontrada. Usando branch padrão (provável main)."
  fi
  echo "Construindo imagem local evolution-api:${EVOLUTION_VERSION}"
  if docker build -t "${EVOLUTION_IMAGE_LOCAL}" -f Dockerfile .; then
    EVOLUTION_IMAGE="${EVOLUTION_IMAGE_LOCAL}"
    echo "Build OK: usando imagem local ${EVOLUTION_IMAGE}"
  else
    echo "[AVISO] Falha ao construir imagem local. Usando imagem padrão do Docker Hub: ${EVOLUTION_IMAGE_DEFAULT}"
    EVOLUTION_IMAGE="${EVOLUTION_IMAGE_DEFAULT}"
  fi
  cd "$PROJECT_DIR"
else
  echo "[AVISO] 'git' não encontrado. Instalando diretamente via imagem do Docker Hub: ${EVOLUTION_IMAGE_DEFAULT}"
  EVOLUTION_IMAGE="${EVOLUTION_IMAGE_DEFAULT}"
fi

# Verifica se a imagem escolhida existe localmente; tenta pull e fallback para 'latest' se necessário
if ! docker image inspect "${EVOLUTION_IMAGE}" >/dev/null 2>&1; then
  echo "[INFO] Imagem ${EVOLUTION_IMAGE} não encontrada localmente. Tentando puxar..."
  if ! docker pull "${EVOLUTION_IMAGE}" >/dev/null 2>&1; then
    echo "[AVISO] Não foi possível obter ${EVOLUTION_IMAGE}. Usando atendai/evolution-api:latest"
    EVOLUTION_IMAGE="atendai/evolution-api:latest"
    if ! docker pull "${EVOLUTION_IMAGE}" >/dev/null 2>&1; then
      echo "[ERRO] Falha ao obter imagem atendai/evolution-api:latest. Verifique sua conexão Docker/registry."
      exit 1
    fi
  fi
fi

echo "\n==> Escrevendo .env.evolution"
# Define URL pública conforme proxy ativo (nginx/traefik) ou IP:porta
if [[ -n "$EVOLUTION_DOMAIN" ]] && (docker ps --format '{{.Names}}' | grep -q '^nginx-proxy$' || docker ps --format '{{.Names}}' | grep -q '^traefik$'); then
  SERVER_URL_VAL="https://${EVOLUTION_DOMAIN}"
else
  SERVER_URL_VAL="http://${SERVER_PUBLIC_IP}:8080"
fi
cat > "$ENV_FILE_EVO" <<EOF
# Gerado pelo install-evolution.sh
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY}
EVOLUTION_VERSION=${EVOLUTION_VERSION}
EVOLUTION_IMAGE=${EVOLUTION_IMAGE}
TRAEFIK_ENABLE=${TRAEFIK_ENABLE}
SERVER_TYPE=http
SERVER_URL=${SERVER_URL_VAL}
EOF

echo "\n==> Removendo Evolution API (se existir)"
if docker ps -a --format '{{.Names}}' | grep -q '^evolution_api$'; then
  docker rm -f evolution_api || true
fi

echo "\n==> Garantindo redes Docker (app_net, proxy)"
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

echo "\n==> Publicando Evolution API"
docker compose -f "$PROJECT_DIR/scripts/evolution-compose.yml" --env-file "$ENV_FILE_EVO" up -d --remove-orphans

echo "\n=== Evolution instalada ==="
if docker ps --format '{{.Names}}' | grep -q '^nginx-proxy$'; then
  echo "Evolution API: https://${EVOLUTION_DOMAIN} (via Nginx)"
  echo "Certificado: acompanhe em 'docker logs nginx-proxy-acme'"
elif docker ps --format '{{.Names}}' | grep -q '^traefik$'; then
  echo "Evolution API: https://${EVOLUTION_DOMAIN} (via Traefik)"
  echo "Certificado: acompanhe em 'docker logs traefik'"
else
  echo "Evolution API: http://${SERVER_PUBLIC_IP}:8080 (sem proxy)"
fi
echo "Evolution Public Key (AUTHENTICATION_API_KEY): ${VITE_EVOLUTION_API_KEY}"
echo "Guarde esta chave; será usada pelo ChatNegocios."