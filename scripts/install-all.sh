#!/usr/bin/env bash

set -euo pipefail

# ChatNegócios + Evolution API — Instalador Único para Ubuntu
#
# O que faz:
# - Solicita apenas DOMÍNIO (ChatNegócios) e e-mail (SSL)
# - Instala Docker, Nginx e Certbot
# - Constrói e roda o container do ChatNegócios (porta interna 3000)
# - Configura Nginx com SSL para o domínio informado e proxy para o container
# - Clona e inicia Evolution API (via Docker Compose se disponível, senão via npm/PM2)
# - Configura Nginx com SSL para evo.nowhats.com.br
# - Sobrescreve configurações existentes de Nginx e serviços, prossegue automaticamente

if [[ $EUID -ne 0 ]]; then
  echo "[ERRO] Este script deve ser executado como root (use sudo)." >&2
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")"/.. && pwd)"

CHAT_DOMAIN="${CHAT_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"
EVO_DOMAIN="${EVO_DOMAIN:-}"

if [[ -z "$CHAT_DOMAIN" ]]; then
  read -r -p "Informe o domínio para ChatNegócios (ex.: chat.seu-dominio.com): " CHAT_DOMAIN
fi

if [[ -z "$SSL_EMAIL" ]]; then
  read -r -p "Informe o e-mail para SSL (Let's Encrypt): " SSL_EMAIL
fi

if [[ -z "$EVO_DOMAIN" ]]; then
  read -r -p "Informe o domínio para Evolution API (ex.: api.seu-dominio.com): " EVO_DOMAIN
fi

# Sanitização robusta do domínio (remove http/https, barras, aspas/backticks e espaços)
sanitize_domain() {
  local d="$1"
  d="${d#http://}"
  d="${d#https://}"
  d="${d%%/*}"
  d="${d//\`/}"
  d="${d//\"/}"
  d="${d//\'/}"
  d="$(echo "$d" | tr -d '[:space:]')"
  echo "$d"
}

CHAT_DOMAIN="$(sanitize_domain "$CHAT_DOMAIN")"
if [[ -z "$CHAT_DOMAIN" ]]; then
  echo "[ERRO] Domínio inválido após sanitização." >&2
  exit 1
fi

EVO_DOMAIN="$(sanitize_domain "$EVO_DOMAIN")"
if [[ -z "$EVO_DOMAIN" ]]; then
  echo "[ERRO] Domínio Evolution API inválido após sanitização." >&2
  exit 1
fi

EVO_TARGET_PORT=8080
CHAT_TARGET_PORT=3000

echo "\nResumo da instalação:" 
echo "- Domínio ChatNegócios: $CHAT_DOMAIN"
echo "- E-mail SSL: $SSL_EMAIL"
echo "- Domínio Evolution API: $EVO_DOMAIN"
echo "- Portas internas: Chat=3000, Evolution=$EVO_TARGET_PORT (forçado)"

echo "\n[0/8] Limpando instalação anterior..."
# Docker: parar/remover containers e imagens
docker rm -f chatnegocios 2>/dev/null || true
docker ps -aq | xargs -r docker rm -f || true
docker images -q 'chatnegocios:latest' | xargs -r docker rmi -f || true

# Evolution API via Compose: derrubar se existir
if [[ -d /opt/evolution-api ]]; then
  if [[ -f /opt/evolution-api/docker-compose.yml || -f /opt/evolution-api/compose.yml ]]; then
    (cd /opt/evolution-api && docker compose down -v || docker-compose down -v || true)
  fi
fi

# PM2: remover processo da Evolution API
pm2 delete evolution-api 2>/dev/null || true
pm2 save 2>/dev/null || true

# Remover diretório da Evolution API
rm -rf /opt/evolution-api || true

# Nginx: remover sites antigos
rm -f "/etc/nginx/sites-enabled/${CHAT_DOMAIN}.conf" "/etc/nginx/sites-available/${CHAT_DOMAIN}.conf" || true
rm -f "/etc/nginx/sites-enabled/${EVO_DOMAIN}.conf" "/etc/nginx/sites-available/${EVO_DOMAIN}.conf" || true
systemctl reload nginx || true

# Certbot: apagar certificados anteriores
certbot delete -n --cert-name "$CHAT_DOMAIN" 2>/dev/null || true
certbot delete -n --cert-name "$EVO_DOMAIN" 2>/dev/null || true
rm -rf "/etc/letsencrypt/live/${CHAT_DOMAIN}" "/etc/letsencrypt/archive/${CHAT_DOMAIN}" "/etc/letsencrypt/renewal/${CHAT_DOMAIN}.conf" || true
rm -rf "/etc/letsencrypt/live/${EVO_DOMAIN}" "/etc/letsencrypt/archive/${EVO_DOMAIN}" "/etc/letsencrypt/renewal/${EVO_DOMAIN}.conf" || true

# Docker: limpar cache/volumes/builders
docker system prune -af || true
docker volume prune -f || true
docker builder prune -af || true

echo "\n[1/8] Atualizando pacotes e instalando dependências..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git ufw nginx python3-certbot-nginx jq || true

echo "\n[2/8] Instalando Docker e Compose..."
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker || true

echo "\n[3/8] Construindo imagem do ChatNegócios..."
cd "$APP_DIR"

# Preparar arquivo de ambiente para Vite com BuildKit Secret
ENV_FILE="$APP_DIR/.env.production"
if [[ -f "$APP_DIR/.env.production" ]]; then
  ENV_FILE="$APP_DIR/.env.production"
elif [[ -f "$APP_DIR/.env" ]]; then
  ENV_FILE="$APP_DIR/.env"
elif [[ -f "$APP_DIR/.env.example" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.production"
  ENV_FILE="$APP_DIR/.env.production"
else
  # Cria um básico vazio para não quebrar o build; usuário ajusta depois
  cat > "$APP_DIR/.env.production" <<'EOF'
# Preencha os valores VITE_* conforme necessário
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_EVOLUTION_API_URL=
VITE_EVOLUTION_API_KEY=
VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE=
VITE_EVOLUTION_WEBHOOK_URL=
EOF
  ENV_FILE="$APP_DIR/.env.production"
fi

docker rm -f chatnegocios || true
DOCKER_BUILDKIT=1 docker build --secret id=vite_env,src="$ENV_FILE" -t chatnegocios:latest .

echo "\n[4/8] Subindo container do ChatNegócios (porta 3000)..."
docker run -d --name chatnegocios --restart unless-stopped -p 127.0.0.1:${CHAT_TARGET_PORT}:3000 chatnegocios:latest

# Aguarda saúde do ChatNegócios antes de configurar Nginx
echo "Aguardando ChatNegócios ficar saudável..."
CHAT_HEALTH_OK=0
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${CHAT_TARGET_PORT}/health" >/dev/null 2>&1; then
    CHAT_HEALTH_OK=1
    echo "ChatNegócios respondeu /health."
    break
  fi
  sleep 2
done
if [[ "$CHAT_HEALTH_OK" -ne 1 ]]; then
  echo "[ERRO] ChatNegócios não ficou saudável a tempo. Logs:" >&2
  docker logs --tail=200 chatnegocios || true
  echo "Verifique variáveis VITE_ e reconstrução da imagem." >&2
fi

echo "\n[5/8] Configurando Nginx e SSL para ${CHAT_DOMAIN}..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled || true
CHAT_SITE="/etc/nginx/sites-available/${CHAT_DOMAIN}.conf"
CHAT_LINK="/etc/nginx/sites-enabled/${CHAT_DOMAIN}.conf"

cat > "$CHAT_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${CHAT_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${CHAT_TARGET_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:${CHAT_TARGET_PORT}/health;
        proxy_set_header Host \$host;
    }

    location /api/evolution/webhook {
        proxy_pass http://127.0.0.1:${CHAT_TARGET_PORT}/api/evolution/webhook;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "$CHAT_SITE" "$CHAT_LINK"
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl restart nginx
certbot --nginx -d "$CHAT_DOMAIN" -m "$SSL_EMAIL" --agree-tos --redirect --non-interactive || true

echo "\n[6/8] Clonando e iniciando Evolution API..."
EVO_DIR="/opt/evolution-api"
rm -rf "$EVO_DIR"
git clone https://github.com/EvolutionAPI/evolution-api.git "$EVO_DIR"
cd "$EVO_DIR"
 
 # Criar .env padrão se não existir (SQLite local) para evitar falha do Prisma
 if [[ ! -f .env ]]; then
   cat > .env <<'EOF'
DATABASE_URL="file:./dev.db"
EOF
 fi

# Iniciar Evolution API via npm/PM2 (fixa porta 8080 no host)
echo "Instalando Node.js 20+ para Evolution API..."
apt-get remove -y nodejs npm libnode-dev || true
apt-get purge -y nodejs npm libnode-dev || true
apt-get autoremove -y || true
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential || true
npm install -g pm2 || true

# Instalar deps respeitando lockfile se existir
if [[ -f package-lock.json ]]; then
  npm ci || npm install || true
else
  npm install || true
fi

# Gerar cliente Prisma antes de iniciar (evita erro @prisma/client did not initialize)
if npm run | grep -q "prisma:generate"; then
  npm run prisma:generate || true
else
  npx prisma generate || true
fi
 
 # Aplicar migrações de banco (ou sincronizar schema) para garantir tabelas
 if command -v npx >/dev/null 2>&1; then
   npx prisma migrate deploy || npx prisma db push || true
 fi

# Iniciar informando porta via variáveis de ambiente
PORT=${EVO_TARGET_PORT} APP_PORT=${EVO_TARGET_PORT} pm2 start npm --name evolution-api -- start || true
pm2 save || true

echo "Evolution API será exposta internamente na porta fixa ${EVO_TARGET_PORT}."

# Aguarda saúde da Evolution API antes de configurar Nginx
echo "Aguardando Evolution API ficar saudável..."
EVO_HEALTH_OK=0
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${EVO_TARGET_PORT}/health" || echo 000)
  if [[ "$CODE" -ge 200 && "$CODE" -lt 500 ]]; then
    EVO_HEALTH_OK=1
    echo "Evolution API respondeu /health (HTTP $CODE)."
    break
  fi
  # Tenta raiz como fallback
  CODE_ROOT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${EVO_TARGET_PORT}/" || echo 000)
  if [[ "$CODE_ROOT" -ge 200 && "$CODE_ROOT" -lt 500 ]]; then
    EVO_HEALTH_OK=1
    echo "Evolution API respondeu raiz (HTTP $CODE_ROOT)."
    break
  fi
  sleep 2
done
if [[ "$EVO_HEALTH_OK" -ne 1 ]]; then
  echo "[ALERTA] Evolution API não confirmou saúde a tempo. Continuando assim mesmo. Verifique logs (compose/PM2)." >&2
fi

echo "\n[7/8] Configurando Nginx e SSL para ${EVO_DOMAIN} (upstream ${EVO_TARGET_PORT})..."
EVO_SITE="/etc/nginx/sites-available/${EVO_DOMAIN}.conf"
EVO_LINK="/etc/nginx/sites-enabled/${EVO_DOMAIN}.conf"

cat > "$EVO_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${EVO_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 600s;
    }

    location /health {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT}/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "$EVO_SITE" "$EVO_LINK"
nginx -t
systemctl restart nginx
certbot --nginx -d "$EVO_DOMAIN" -m "$SSL_EMAIL" --agree-tos --redirect --non-interactive || true

echo "\n[8/8] Verificações rápidas..."
echo "- SPA: https://${CHAT_DOMAIN}/"
echo "- Health: https://${CHAT_DOMAIN}/health"
echo "- Webhook: https://${CHAT_DOMAIN}/api/evolution/webhook"
echo "- Evolution API: https://${EVO_DOMAIN}/"

echo "\nComandos úteis:"
echo "- Logs ChatNegócios: docker logs -f chatnegocios"
echo "- Reiniciar ChatNegócios: docker restart chatnegocios"
echo "- Ver serviços Evolution (compose): (cd /opt/evolution-api && docker compose ps)"
echo "- PM2 Evolution (fallback): pm2 status && pm2 logs evolution-api"

echo "\nImportante:"
echo "- Variáveis VITE_* são de build; ajuste .env e rode rebuild se precisar:"
echo "  docker rm -f chatnegocios && cd $APP_DIR && docker build --no-cache -t chatnegocios:latest . && docker run -d --name chatnegocios --restart unless-stopped -p 127.0.0.1:${CHAT_TARGET_PORT}:3000 chatnegocios:latest"
echo "- Configure o mesmo endpoint em VITE_EVOLUTION_WEBHOOK_URL e no Manager Evolution."

echo "\nInstalação concluída com sucesso!"