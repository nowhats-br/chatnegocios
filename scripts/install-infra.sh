#!/usr/bin/env bash
set -euo pipefail

# Infra Installer — instala Docker, cria redes, sobe Portainer e Traefik (ACME/SSL)
# Uso interativo: sudo bash scripts/install-infra.sh
# Uso não-interativo: ACME_EMAIL=seu@email sudo -E bash scripts/install-infra.sh

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute este script como root (sudo)." >&2
  exit 1
fi

ACME_EMAIL=${ACME_EMAIL:-}
if [[ -z "$ACME_EMAIL" ]]; then
  read -rp "Informe o e-mail para SSL (ACME/Let's Encrypt): " ACME_EMAIL
fi
if [[ -z "$ACME_EMAIL" ]]; then
  echo "[ERRO] E-mail ACME é obrigatório." >&2
  exit 1
fi

PROJECT_DIR="$(pwd)"
ENV_FILE_INfra="${PROJECT_DIR}/.env.infra"

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

echo "\n==> Escrevendo .env.infra"
cat > "$ENV_FILE_INfra" <<EOF
# Gerado pelo install-infra.sh
ACME_EMAIL=${ACME_EMAIL}
EOF

echo "\n==> Removendo Portainer/Traefik (se existirem)"
for c in traefik portainer; do
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
  --network proxy \
  portainer/portainer-ce:latest

echo "\n==> Publicando Traefik (com Let's Encrypt)"
docker compose -f "$PROJECT_DIR/scripts/traefik-compose.yml" --env-file "$ENV_FILE_INfra" up -d

echo "\n=== Infra concluída ==="
echo "Portainer: http://SEU_SERVIDOR:9000"
echo "Traefik ativo nas portas 80/443."