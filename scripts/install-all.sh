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
# - Configura Nginx com SSL para api.nowhats.com.br
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

# Dica de migração: domínios nowhats
if [[ "$EVO_DOMAIN" == "evo.nowhats.com.br" ]]; then
  echo "[AVISO] Detectado domínio antigo (evo.nowhats.com.br). Recomenda-se usar api.nowhats.com.br."
fi
if [[ "$CHAT_DOMAIN" == "chat.nowhats.com.br" ]]; then
  echo "[AVISO] Detectado domínio antigo (chat.nowhats.com.br). Recomenda-se usar chatnegocios.nowhats.com.br."
fi

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

echo "\n[1/8] Atualizando pacotes e instalando dependências (modo rápido)..."
# Modo rápido: reduzir travas de rede e desabilitar fontes lentas
export DEBIAN_FRONTEND=noninteractive
APT_OPTS="-o Dpkg::Use-Pty=0 -o Acquire::http::Timeout=10 -o Acquire::https::Timeout=10 -o Acquire::Retries=1 -o Acquire::Check-Valid-Until=false -o Acquire::http::No-Cache=true -o Acquire::ForceIPv4=true"

# Desabilitar repositórios NodeSource se presentes (evita lentidão em \"nodistro\")
if [[ -f /etc/apt/sources.list.d/nodesource.list || -f /etc/apt/sources.list.d/nodesource.sources ]]; then
  echo "[INFO] Desabilitando NodeSource para evitar lentidão..."
  rm -f /etc/apt/sources.list.d/nodesource.list /etc/apt/sources.list.d/nodesource.sources || true
fi
# Reparar possíveis fontes comentadas indevidamente por versões anteriores do instalador
for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  [[ -f "$f" ]] && sed -i 's/^# desabilitado pelo instalador: //g' "$f"
done
# Comentar apenas linhas que referenciam NodeSource (sem afetar outras fontes)
while IFS= read -r f; do
  sed -i '/deb\.nodesource\.com/ s/^/# desabilitado pelo instalador: /' "$f"
done < <(grep -Rl "deb.nodesource.com" /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null || true)

echo "[INFO] Executando apt-get update com timeout (60s)..."
timeout 60s apt-get update $APT_OPTS || echo "[WARN] apt-get update lento ou falhou; prosseguindo com cache atual."

# Instalar pacotes essenciais com recomendações desativadas
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release git ufw nginx python3-certbot-nginx jq $APT_OPTS || true

echo "\n[2/8] Instalando Docker e Compose (modo rápido)..."
if ! command -v docker >/dev/null 2>&1; then
  echo "[INFO] Instalando Docker via script oficial (get.docker.com) — caminho mais rápido."
  if curl -fsSL https://get.docker.com -o /tmp/getdocker.sh; then
    sh /tmp/getdocker.sh || echo "[WARN] Falha no script oficial; tentando via repositório apt."
  else
    echo "[WARN] Não foi possível baixar get.docker.com; tentando via repositório apt."
  fi
  # Fallback apt para Docker caso o script não tenha instalado
  if ! command -v docker >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    echo "[INFO] Atualizando índices do Docker com timeout (60s)..."
    timeout 60s apt-get update $APT_OPTS || echo "[WARN] update do Docker lento; tentando instalar diretamente."
    apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin $APT_OPTS || true
  fi
fi

# Garantir que o plugin docker compose esteja disponível
if ! docker compose version >/dev/null 2>&1; then
  echo "[INFO] Instalando plugin docker-compose-plugin (se ausente)"
  apt-get install -y --no-install-recommends docker-compose-plugin $APT_OPTS || true
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

echo "\n[3.5/8] Subindo Postgres para ChatNegócios..."
docker network inspect chat_net >/dev/null 2>&1 || docker network create chat_net
DB_NAME="chatnegocios"
DB_USER="chatnegocios"
DB_PASS="${CHAT_DB_PASS:-ChatNegocios123!}"
docker rm -f postgres-chatnegocios || true
docker run -d --name postgres-chatnegocios --restart unless-stopped \
  --network chat_net \
  -e POSTGRES_DB="$DB_NAME" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" \
  -v chat_pgdata:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 postgres:15-alpine
echo "Aguardando Postgres ficar saudável..."
PG_HEALTH_OK=0
for i in $(seq 1 30); do
  if docker exec postgres-chatnegocios pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    PG_HEALTH_OK=1
    echo "Postgres respondeu."
    break
  fi
  sleep 2
done
if [[ "$PG_HEALTH_OK" -ne 1 ]]; then
  echo "[ERRO] Postgres não ficou saudável a tempo." >&2
fi
DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@postgres-chatnegocios:5432/${DB_NAME}"

echo "\n[4/8] Subindo container do ChatNegócios (porta 3000)..."
docker run -d --name chatnegocios --restart unless-stopped --network chat_net \
  -e DATABASE_URL="$DATABASE_URL" -e WEBHOOK_PATH="/api/evolution/webhook" -e PORT=3000 \
  -p 127.0.0.1:${CHAT_TARGET_PORT}:3000 chatnegocios:latest

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
    server_name ${CHAT_DOMAIN} www.${CHAT_DOMAIN};

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

# Criar um vhost catch-all para evitar que domínios não configurados caiam na SPA
CATCH_ALL="/etc/nginx/sites-available/00-catch-all.conf"
cat > "$CATCH_ALL" <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
EOF
ln -sf "$CATCH_ALL" "/etc/nginx/sites-enabled/00-catch-all.conf"

nginx -t
systemctl restart nginx
# Permite uso opcional do ambiente de staging do Let's Encrypt para testes
CERTBOT_EXTRA_ARGS=""
if [[ "${USE_CERTBOT_STAGING:-0}" -eq 1 ]]; then
  echo "[INFO] Usando Let's Encrypt em modo STAGING para ${CHAT_DOMAIN}."
  CERTBOT_EXTRA_ARGS="--staging"
fi
certbot --nginx -d "$CHAT_DOMAIN" -m "$SSL_EMAIL" --agree-tos --redirect --non-interactive $CERTBOT_EXTRA_ARGS || true

# Detecta se o certificado foi emitido com sucesso para ajustar mensagens finais
CHAT_SSL_ENABLED=0
if [[ -f "/etc/letsencrypt/live/${CHAT_DOMAIN}/fullchain.pem" && -f "/etc/letsencrypt/live/${CHAT_DOMAIN}/privkey.pem" ]]; then
  CHAT_SSL_ENABLED=1
fi

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

# Detectar Prisma Schema antes de gerar cliente/migrar
HAS_PRISMA_SCHEMA=0
if [[ -f prisma/schema.prisma || -f schema.prisma ]]; then
  HAS_PRISMA_SCHEMA=1
fi

# Gerar cliente Prisma antes de iniciar, somente se houver schema
if [[ "$HAS_PRISMA_SCHEMA" -eq 1 ]]; then
  if npm run | grep -q "prisma:generate"; then
    npm run prisma:generate || true
  else
    npx prisma generate || true
  fi
else
  echo "[AVISO] Prisma schema não encontrado (prisma/schema.prisma ou schema.prisma). Pulando geração do cliente." >&2
fi

# Aplicar migrações (ou sincronizar schema), somente se houver schema
if [[ "$HAS_PRISMA_SCHEMA" -eq 1 ]] && command -v npx >/dev/null 2>&1; then
  npx prisma migrate deploy || npx prisma db push || true
else
  echo "[AVISO] Prisma schema ausente ou npx indisponível. Pulando migrações/sincronização." >&2
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
  echo "[ALERTA] Evolution API não confirmou saúde a tempo. Tentando auto-detectar porta real." >&2
  # Auto-detecção de porta: verifica portas comuns e ajusta upstream se encontrar resposta
  for p in 8080 4020 4001 4000 3000; do
    if curl -sf "http://127.0.0.1:${p}/health" >/dev/null 2>&1 || curl -sf "http://127.0.0.1:${p}/" >/dev/null 2>&1; then
      EVO_TARGET_PORT="$p"
      echo "[INFO] Detectado Evolution API respondendo na porta ${EVO_TARGET_PORT}. Upstream ajustado."
      EVO_HEALTH_OK=1
      break
    fi
  done
  if [[ "$EVO_HEALTH_OK" -ne 1 ]]; then
    echo "[ALERTA] Não foi possível detectar porta da Evolution API. Prosseguindo com ${EVO_TARGET_PORT}. Verifique PM2 e logs." >&2
  fi
fi

echo "\n[7/8] Configurando Nginx e SSL para ${EVO_DOMAIN} (upstream ${EVO_TARGET_PORT})..."
EVO_SITE="/etc/nginx/sites-available/${EVO_DOMAIN}.conf"
EVO_LINK="/etc/nginx/sites-enabled/${EVO_DOMAIN}.conf"

cat > "$EVO_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${EVO_DOMAIN} www.${EVO_DOMAIN};

    # Aceitar payloads maiores e reduzir chances de 502 por timeout
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${EVO_TARGET_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 15s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        proxy_buffering off;
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
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl restart nginx
# Usa staging opcionalmente para evitar limites durante testes
EVO_CERTBOT_EXTRA_ARGS=""
if [[ "${USE_CERTBOT_STAGING:-0}" -eq 1 ]]; then
  echo "[INFO] Usando Let's Encrypt em modo STAGING para ${EVO_DOMAIN}."
  EVO_CERTBOT_EXTRA_ARGS="--staging"
fi
certbot --nginx -d "$EVO_DOMAIN" -m "$SSL_EMAIL" --agree-tos --redirect --non-interactive $EVO_CERTBOT_EXTRA_ARGS || true

# Detecta certificado da Evolution API para ajustar mensagens finais
EVO_SSL_ENABLED=0
if [[ -f "/etc/letsencrypt/live/${EVO_DOMAIN}/fullchain.pem" && -f "/etc/letsencrypt/live/${EVO_DOMAIN}/privkey.pem" ]]; then
  EVO_SSL_ENABLED=1
fi

echo "\n[8/8] Verificações rápidas..."
if [[ "$CHAT_SSL_ENABLED" -eq 1 ]]; then
  echo "- SPA: https://${CHAT_DOMAIN}/"
  echo "- Health: https://${CHAT_DOMAIN}/health"
  echo "- Webhook: https://${CHAT_DOMAIN}/api/evolution/webhook"
else
  echo "- SPA: http://${CHAT_DOMAIN}/"
  echo "- Health: http://${CHAT_DOMAIN}/health"
  echo "- Webhook: http://${CHAT_DOMAIN}/api/evolution/webhook"
fi
if [[ "$EVO_SSL_ENABLED" -eq 1 ]]; then
  echo "- Evolution API: https://${EVO_DOMAIN}/"
  if [[ "${USE_CERTBOT_STAGING:-0}" -eq 1 ]]; then
    echo "  (emitido em STAGING; não confiável publicamente. Reemita sem --staging quando liberar o limite.)"
  fi
else
  echo "- Evolution API: http://${EVO_DOMAIN}/"
  echo "  (sem SSL; você pode ativar depois rodando certbot ou reexecutando com USE_CERTBOT_STAGING=1 para testes)"
fi

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