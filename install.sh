#!/usr/bin/env bash
set -euo pipefail

# Instalador bootstrap: clona o projeto na HOME do usuário correto
# e executa o instalador completo (scripts/install-all.sh).

log() {
  echo "[install.sh] $*"
}

# Descobrir usuário alvo e HOME de forma robusta
RUN_AS_USER="${SUDO_USER:-$(id -un)}"
if [[ "$RUN_AS_USER" == "root" ]]; then
  TARGET_HOME="${HOME:-/root}"
else
  TARGET_HOME="$(getent passwd "$RUN_AS_USER" | cut -d: -f6 || true)"
  if [[ -z "${TARGET_HOME:-}" ]]; then
    TARGET_HOME="$(eval echo "~$RUN_AS_USER")"
  fi
fi

if [[ -z "${TARGET_HOME:-}" ]]; then
  echo "ERRO: Não foi possível determinar a HOME para o usuário '$RUN_AS_USER'."
  exit 1
fi

log "Usuário alvo: $RUN_AS_USER"
log "HOME alvo: $TARGET_HOME"

# Garantir git instalado
if ! command -v git >/dev/null 2>&1; then
  log "Git não encontrado. Instalando via apt-get..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y git
  else
    echo "ERRO: apt-get não disponível para instalar git. Instale git manualmente."
    exit 1
  fi
fi

# Coleta de variáveis de ambiente (ou prompt)
CHAT_DOMAIN="${CHAT_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"
EVO_DOMAIN="${EVO_DOMAIN:-}"

if [[ -z "$CHAT_DOMAIN" ]]; then
  read -rp "Informe o domínio do ChatNegócios (ex: chat.seu-dominio.com): " CHAT_DOMAIN
fi
if [[ -z "$SSL_EMAIL" ]]; then
  read -rp "Informe o e-mail para SSL (Let's Encrypt): " SSL_EMAIL
fi
if [[ -z "$EVO_DOMAIN" ]]; then
  read -rp "Informe o domínio para Evolution API (ex: api.seu-dominio.com): " EVO_DOMAIN
fi

# Detectar se já estamos dentro de um clone existente
CURRENT_DIR="$(pwd)"
if [[ -f "$CURRENT_DIR/scripts/install-all.sh" ]]; then
  TARGET_DIR="$CURRENT_DIR"
  log "Repositório já presente no diretório atual: '$TARGET_DIR'. Pulando clone."
else
  TARGET_DIR="${TARGET_DIR:-$TARGET_HOME/chatnegocios}"
  log "Preparando diretório de destino: $TARGET_DIR"
  mkdir -p "$(dirname "$TARGET_DIR")"
  if [[ -d "$TARGET_DIR/.git" ]]; then
    log "Repositório já existe em '$TARGET_DIR'. Pulando clone."
  elif [[ -d "$TARGET_DIR" && -n "$(ls -A "$TARGET_DIR" 2>/dev/null)" ]]; then
    log "Diretório destino existe e não está vazio. Usando-o sem clonar."
  else
    log "Clonando repositório em '$TARGET_DIR'..."
    git clone --depth 1 https://github.com/nowhats-br/chatnegocios.git "$TARGET_DIR"
  fi
fi

if [[ ! -d "$TARGET_DIR/scripts" ]]; then
  echo "ERRO: pasta 'scripts' não encontrada em '$TARGET_DIR'."
  exit 1
fi

log "Executando instalador completo (scripts/install-all.sh)..."
export CHAT_DOMAIN SSL_EMAIL EVO_DOMAIN
bash "$TARGET_DIR/scripts/install-all.sh"

log "Instalação concluída."