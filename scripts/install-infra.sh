#!/usr/bin/env bash
set -euo pipefail

# Infra Installer — instala Docker, cria rede e sobe Portainer (sem Traefik)
# Uso: sudo bash scripts/install-infra.sh

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

echo "\n==> Criando redes Docker (proxy, app_net)"
docker network inspect app_net >/dev/null 2>&1 || docker network create app_net

echo "\n==> Removendo Portainer (se existir)"
for c in portainer; do
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

echo "\n=== Infra concluída ==="
echo "Portainer: http://${SERVER_PUBLIC_IP:-SEU_SERVIDOR}:9000"