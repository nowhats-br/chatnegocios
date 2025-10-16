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

echo "\n==> Publicando Evolution API"
docker compose -f "$PROJECT_DIR/scripts/evolution-compose.yml" --env-file "$ENV_FILE_EVO" up -d --remove-orphans

echo "\n=== Evolution instalada ==="
echo "Evolution API: https://${EVOLUTION_DOMAIN}"
echo "Evolution Public Key (AUTHENTICATION_API_KEY): ${VITE_EVOLUTION_API_KEY}"
echo "Guarde esta chave; será usada pelo ChatNegocios."