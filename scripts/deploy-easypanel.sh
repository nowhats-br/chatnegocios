#!/bin/bash

# Script de deploy otimizado para EasyPanel
set -e

echo "🚀 Iniciando deploy otimizado para EasyPanel..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando. Inicie o Docker primeiro."
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    warning ".env não encontrado. Copiando .env.example..."
    cp .env.example .env
    warning "Configure as variáveis em .env antes do deploy!"
fi

# Limpar builds anteriores
log "Limpando cache anterior..."
docker builder prune -f > /dev/null 2>&1 || true

# Build otimizado
log "Fazendo build da imagem Docker..."
start_time=$(date +%s)

docker build \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from chatnegocios:latest \
    --tag chatnegocios:latest \
    --tag chatnegocios:$(date +%Y%m%d-%H%M%S) \
    . || error "Falha no build da imagem"

end_time=$(date +%s)
build_time=$((end_time - start_time))
success "Build concluído em ${build_time}s"

# Mostrar tamanho da imagem
log "Informações da imagem:"
docker images chatnegocios:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Testar a imagem
log "Testando a imagem..."
container_id=$(docker run -d -p 3002:3001 --env-file .env chatnegocios:latest)

# Aguardar inicialização
sleep 10

# Testar health check
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    success "Health check passou!"
else
    warning "Health check falhou, mas a imagem foi criada"
fi

# Parar container de teste
docker stop $container_id > /dev/null 2>&1
docker rm $container_id > /dev/null 2>&1

# Instruções finais
echo ""
echo "🎉 Deploy preparado com sucesso!"
echo ""
echo "📋 Próximos passos no EasyPanel:"
echo "1. Faça upload da imagem ou conecte o repositório Git"
echo "2. Configure as variáveis de ambiente:"
echo "   - EVOLUTION_API_URL"
echo "   - EVOLUTION_API_KEY"
echo "   - SUPABASE_URL (opcional)"
echo "   - SUPABASE_SERVICE_ROLE_KEY (opcional)"
echo "3. Use a porta 3001"
echo "4. Configure health check: /api/health"
echo ""
echo "🐳 Para testar localmente:"
echo "   docker run -p 3001:3001 --env-file .env chatnegocios:latest"
echo ""
echo "📊 Tamanho da imagem otimizada: $(docker images chatnegocios:latest --format '{{.Size}}')"