#!/usr/bin/env bash
set -euo pipefail

# generate-evo-token.sh — Gera apikey para Evolution API e injeta nas variáveis do Vite
# Uso:
#   ./scripts/generate-evo-token.sh --domain api.seu-dominio.com \
#     [--evo-dir /opt/evolution-api] [--vite-env /caminho/app/.env.production] [--webhook-path /api/evolution/webhook]

DOMAIN=""
EVO_DIR="/opt/evolution-api"
VITE_ENV_FILE=""
WEBHOOK_PATH=""
APIKEY_OVERRIDE=""
WEBHOOK_URL_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="$2"; shift 2 ;;
    --evo-dir)
      EVO_DIR="$2"; shift 2 ;;
    --vite-env)
      VITE_ENV_FILE="$2"; shift 2 ;;
    --webhook-path)
      WEBHOOK_PATH="$2"; shift 2 ;;
    --apikey)
      APIKEY_OVERRIDE="$2"; shift 2 ;;
    --webhook-url)
      WEBHOOK_URL_OVERRIDE="$2"; shift 2 ;;
    *)
      echo "[AVISO] Argumento desconhecido: $1"; shift ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "[ERRO] --domain é obrigatório (domínio público da Evolution API)." >&2
  exit 1
fi

# Função auxiliar para atualizar ou adicionar uma linha KEY=VALUE em arquivo .env
set_or_update_env() {
  local file="$1"; shift
  local key="$1"; shift
  local value="$1"; shift
  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# Define/gera uma apikey segura (pode ser injetada via --apikey)
if [[ -n "$APIKEY_OVERRIDE" ]]; then
  APIKEY="$APIKEY_OVERRIDE"
else
  if command -v openssl >/dev/null 2>&1; then
    APIKEY="$(openssl rand -hex 24)"
  else
    APIKEY="$(date +%s%N | sha256sum | cut -c1-48)"
  fi
fi

echo "[INFO] Gerando apikey Evolution: $APIKEY"

# Atualizar .env da Evolution API, se diretório existir
EVO_ENV_FILE="$EVO_DIR/.env"
if [[ -d "$EVO_DIR" ]]; then
  mkdir -p "$EVO_DIR" || true
  touch "$EVO_ENV_FILE"
  set_or_update_env "$EVO_ENV_FILE" "AUTHENTICATION_API_KEY" "$APIKEY"
  # Compatibilidade com alguns builds que usam AUTHENTICATION__API_KEY__KEY
  set_or_update_env "$EVO_ENV_FILE" "AUTHENTICATION__API_KEY__KEY" "$APIKEY"
  echo "[OK] Atualizado $EVO_ENV_FILE com AUTHENTICATION_API_KEY." 
else
  echo "[AVISO] Diretório da Evolution API ($EVO_DIR) não encontrado. Apenas variáveis do Vite serão atualizadas."
fi

# Atualizar .env do Vite para o ChatNegócios
if [[ -z "$VITE_ENV_FILE" ]]; then
  VITE_ENV_FILE="$(pwd)/.env.production"
fi
touch "$VITE_ENV_FILE"
set_or_update_env "$VITE_ENV_FILE" "VITE_EVOLUTION_API_URL" "https://${DOMAIN}"
set_or_update_env "$VITE_ENV_FILE" "VITE_EVOLUTION_API_KEY" "$APIKEY"
if [[ -n "$WEBHOOK_URL_OVERRIDE" ]]; then
  set_or_update_env "$VITE_ENV_FILE" "VITE_EVOLUTION_WEBHOOK_URL" "$WEBHOOK_URL_OVERRIDE"
fi

echo "[OK] Atualizado $VITE_ENV_FILE com VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY."

# Reiniciar Evolution via PM2, se existir
if command -v pm2 >/dev/null 2>&1; then
  if pm2 list | tr -d '\r' | grep -q "evolution-api"; then
    pm2 restart evolution-api || true
    echo "[INFO] PM2: evolution-api reiniciado para aplicar .env."
  fi
fi

echo "\nResumo:"
echo "- apikey Evolution: $APIKEY"
echo "- .env Evolution: $EVO_ENV_FILE"
echo "- .env Vite: $VITE_ENV_FILE"
echo "- Evolution URL: https://${DOMAIN}/"