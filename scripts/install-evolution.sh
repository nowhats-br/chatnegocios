#!/usr/bin/env bash
set -euo pipefail

# Evolution Installer — publica Evolution API com Traefik e gera public key
# Uso interativo: sudo bash scripts/install-evolution.sh
# Não-interativo: EVOLUTION_DOMAIN=api.seu.domino sudo -E bash scripts/install-evolution.sh
# Opcional: VITE_EVOLUTION_API_KEY=chaveexistente sudo -E bash scripts/install-evolution.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN:-}
VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY:-}

if [[ -z "$EVOLUTION_DOMAIN" ]]; then
  read -rp "Informe o domínio da Evolution (ex: evoapi.seudominio.com): " EVOLUTION_DOMAIN
fi
if [[ -z "$EVOLUTION_DOMAIN" ]]; then
  echo "[ERRO] Domínio da Evolution é obrigatório." >&2
  exit 1
fi

# Valida resolução DNS do domínio informado (evita certificados falhos)
if ! getent hosts "$EVOLUTION_DOMAIN" >/dev/null 2>&1; then
  echo "[ERRO] O domínio '$EVOLUTION_DOMAIN' não resolve para nenhum IP neste servidor." >&2
  echo "       Ajuste seu DNS (A/AAAA) apontando para o IP público e tente novamente." >&2
  exit 1
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

echo "\n==> Escrevendo .env.evolution"
cat > "$ENV_FILE_EVO" <<EOF
# Gerado pelo install-evolution.sh
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY}
EOF

echo "\n==> Removendo Evolution API (se existir)"
if docker ps -a --format '{{.Names}}' | grep -q '^evolution_api$'; then
  docker rm -f evolution_api || true
fi

echo "\n==> Garantindo redes Docker (proxy, app_net)"
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net

echo "\n==> Publicando Evolution API"
docker compose -f "$PROJECT_DIR/scripts/evolution-compose.yml" --env-file "$ENV_FILE_EVO" up -d --remove-orphans

echo "\n=== Evolution instalada ==="
echo "Evolution API: https://${EVOLUTION_DOMAIN}"
echo "Evolution Public Key (AUTHENTICATION_API_KEY): ${VITE_EVOLUTION_API_KEY}"
echo "Guarde esta chave; será usada pelo ChatNegocios."