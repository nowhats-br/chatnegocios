#!/bin/bash

# Script de build otimizado para Docker
set -e

echo "🚀 Iniciando build otimizado..."

# Limpar cache anterior se existir
echo "🧹 Limpando cache..."
docker builder prune -f || true

# Build com cache otimizado
echo "🔨 Fazendo build da imagem..."
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from chatnegocios:latest \
  -t chatnegocios:latest \
  -t chatnegocios:$(date +%Y%m%d-%H%M%S) \
  .

echo "✅ Build concluído com sucesso!"

# Mostrar tamanho da imagem
echo "📦 Tamanho da imagem:"
docker images chatnegocios:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"