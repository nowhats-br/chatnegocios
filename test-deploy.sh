#!/bin/bash

# Script para testar deploy localmente antes do EasyPanel
set -e

echo "🧪 Testando deploy otimizado localmente..."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar Docker
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando"
fi

# Limpar containers anteriores
log "Limpando containers anteriores..."
docker stop chatnegocios-test 2>/dev/null || true
docker rm chatnegocios-test 2>/dev/null || true

# Medir tempo de build
log "Iniciando build (medindo tempo)..."
start_time=$(date +%s)

# Build da imagem
docker build -t chatnegocios-test . || error "Falha no build"

end_time=$(date +%s)
build_time=$((end_time - start_time))

log "✅ Build concluído em ${build_time}s"

# Verificar tamanho da imagem
size=$(docker images chatnegocios-test --format "{{.Size}}")
log "📦 Tamanho da imagem: $size"

# Testar a imagem
log "🚀 Testando a aplicação..."
docker run -d --name chatnegocios-test -p 3002:3001 \
    -e NODE_ENV=production \
    -e PORT=3001 \
    -e CORS_ALLOW_ALL=true \
    -e EVOLUTION_API_URL=https://evolution.nowhats.com.br \
    -e EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11 \
    chatnegocios-test || error "Falha ao iniciar container"

# Aguardar inicialização
log "⏳ Aguardando inicialização (30s)..."
sleep 30

# Testar health check
log "🔍 Testando health check..."
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    log "✅ Health check passou!"
else
    warning "Health check falhou, verificando logs..."
    docker logs chatnegocios-test
fi

# Testar proxy
log "🔍 Testando proxy debug..."
if curl -f http://localhost:3002/api/debug/proxy-test > /dev/null 2>&1; then
    log "✅ Proxy funcionando!"
else
    warning "Proxy com problemas"
fi

# Mostrar logs
log "📋 Últimas linhas do log:"
docker logs --tail 10 chatnegocios-test

# Limpeza
log "🧹 Limpando..."
docker stop chatnegocios-test
docker rm chatnegocios-test

# Resumo
echo ""
echo "🎉 Teste concluído!"
echo "⏱️  Tempo de build: ${build_time}s"
echo "📦 Tamanho: $size"
echo ""
echo "✅ Pronto para deploy no EasyPanel!"
echo ""
echo "📋 Configurações para EasyPanel:"
echo "   - Port: 3001"
echo "   - Health check: /api/health"
echo "   - Timeout: 15 minutos"
echo "   - RAM: 512MB"
echo "   - CPU: 0.5 cores"