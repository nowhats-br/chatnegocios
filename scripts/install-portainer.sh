#!/usr/bin/env bash
set -euo pipefail

DOMAIN="portainer.nowhats.com.br"
NETWORK="chatnegocios"
STACK_NAME="portainer"
ADMIN_USER="admin"
ADMIN_PASS="Family253102*"
ADMIN_EMAIL="suporte@nowhats.com.br"
COMPOSE_FILE="$(dirname "$0")/portainer-compose.yml"

# Verificações de ambiente
if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: docker não encontrado no PATH." >&2
  exit 1
fi

# Swarm ativo
if ! docker info | grep -i "Swarm: active" >/dev/null 2>&1; then
  echo "Docker Swarm não está ativo. Ative com: docker swarm init" >&2
  exit 1
fi

# Rede overlay
if ! docker network ls --format '{{.Name}}' | grep -Fx "$NETWORK" >/dev/null 2>&1; then
  echo "Criando rede overlay $NETWORK";
  docker network create --driver overlay "$NETWORK"
fi

# Gera hash bcrypt da senha do admin via htpasswd (Apache)
# Saída do htpasswd é "admin:<hash>", então cortamos após ':'
HASH=$(docker run --rm --entrypoint htpasswd httpd:2.4-alpine -nbB "$ADMIN_USER" "$ADMIN_PASS" | cut -d: -f2)
TMP_FILE=$(mktemp)
printf "%s" "$HASH" > "$TMP_FILE"

# Cria/atualiza secret para a senha do admin
set +e
docker secret rm portainer_admin_password >/dev/null 2>&1
set -e

docker secret create portainer_admin_password "$TMP_FILE"
rm -f "$TMP_FILE"

# Deploy do Portainer com Traefik
docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME"

cat <<EOF

Portainer em implantação.
- Domínio: https://$DOMAIN
- Usuário: $ADMIN_USER
- Senha: (definida pelo instalador)

Aguarde alguns segundos e acesse a UI. Após o primeiro login, ajuste o e-mail do admin para: $ADMIN_EMAIL (Configurações do usuário).

Dicas:
- Verifique status: docker service ls | grep portainer
- Logs: docker service logs ${STACK_NAME}_portainer --since 1m
- Traefik deve estar rodando com DNS-01 Cloudflare para SSL.
EOF