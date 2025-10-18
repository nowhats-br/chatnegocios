#!/usr/bin/env bash
set -euo pipefail

# Infra Installer — instala Docker, cria redes e sobe Portainer; Traefik opcional
# Uso Portainer apenas: sudo bash scripts/install-infra.sh
# Uso com Traefik (HTTPS): INSTALL_TRAEFIK=1 ACME_EMAIL=seu@email sudo -E bash scripts/install-infra.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

SERVER_PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -z "$SERVER_PUBLIC_IP" ]]; then
  SERVER_PUBLIC_IP="$(ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d'/' -f1 | head -n1)"
fi

PROJECT_DIR="$(pwd)"

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

echo "\n==> Criando redes Docker (chatnegocios, app_net)"

# Garante rede de proxy conforme ambiente (usando nome 'chatnegocios')
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [[ "$SWARM_STATE" == "active" ]]; then
  if docker network inspect chatnegocios >/dev/null 2>&1; then
    ATTACHABLE=$(docker network inspect chatnegocios -f '{{.Attachable}}' 2>/dev/null || echo "unknown")
    if [[ "$ATTACHABLE" != "true" ]]; then
      if [[ "${FORCE_RECREATE_NETWORK:-0}" == "1" ]]; then
        echo "[INFO] Rede 'chatnegocios' existente com attachable=false. Recriando como overlay --attachable..."
        docker network rm chatnegocios || true
        docker network create --driver overlay --attachable chatnegocios
      else
        echo "[ERRO] A rede 'chatnegocios' (overlay) está com attachable=false."
        echo "       Contêineres Docker não conseguem se anexar. Recrie a rede com:"
        echo "       docker network rm chatnegocios && docker network create -d overlay --attachable chatnegocios"
        echo "       (Se estiver em uso por stacks, remova-os antes em Portainer ou com docker stack rm)"
        exit 1
      fi
    fi
  else
    docker network create --driver overlay --attachable chatnegocios
  fi
else
  docker network inspect chatnegocios >/dev/null 2>&1 || docker network create chatnegocios
fi
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net

echo "\n==> Removendo Portainer/Nginx (se existirem)"
for c in portainer nginx-proxy nginx-proxy-acme; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
    echo "Parando/removendo ${c}..." && docker rm -f "${c}" || true
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
  --network app_net \
  portainer/portainer-ce:latest

INSTALL_TRAEFIK=${INSTALL_TRAEFIK:-0}
INSTALL_NGINX=${INSTALL_NGINX:-0}
ACME_EMAIL=${ACME_EMAIL:-}
if [[ "$INSTALL_TRAEFIK" == "1" ]]; then
  if [[ -z "$ACME_EMAIL" ]]; then
    echo "[ERRO] Para instalar Traefik, informe ACME_EMAIL (Let's Encrypt)." >&2
    exit 1
  fi
  echo "\n==> Publicando Traefik (Let's Encrypt)"
  docker compose -f "$PROJECT_DIR/scripts/traefik-compose.yml" --env-file <(echo "ACME_EMAIL=${ACME_EMAIL}") up -d
fi

if [[ "$INSTALL_NGINX" == "1" ]]; then
  if [[ -z "$ACME_EMAIL" ]]; then
    echo "[ERRO] Para instalar Nginx com ACME, informe ACME_EMAIL (Let's Encrypt)." >&2
    exit 1
  fi
  echo "\n==> Publicando Nginx proxy (Let's Encrypt)"
  docker compose -f "$PROJECT_DIR/scripts/nginx-compose.yml" --env-file <(echo "ACME_EMAIL=${ACME_EMAIL}") up -d
fi

echo "\n=== Infra concluída ==="
echo "Portainer: http://${SERVER_PUBLIC_IP:-SEU_SERVIDOR}:9000"
if [[ "$INSTALL_TRAEFIK" == "1" ]]; then
  echo "Proxy ativo: Traefik nas portas 80/443"
fi
if [[ "$INSTALL_NGINX" == "1" ]]; then
  echo "Proxy ativo: Nginx nas portas 80/443"
fi
if [[ "$INSTALL_TRAEFIK" != "1" && "$INSTALL_NGINX" != "1" ]]; then
  echo "Proxy desativado. Para HTTPS via domínio, habilite Traefik ou Nginx."
fi