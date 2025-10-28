#!/bin/bash

echo "🔧 Testando configuração do webhook..."
echo ""

echo "1. Testando comunicação básica..."
curl -s http://localhost:3002/api/test/ping | jq . 2>/dev/null || curl -s http://localhost:3002/api/test/ping
echo ""
echo ""

echo "2. Verificando configuração..."
curl -s http://localhost:3002/api/debug/webhook-config | jq . 2>/dev/null || curl -s http://localhost:3002/api/debug/webhook-config
echo ""
echo ""

echo "3. Testando Evolution API..."
curl -s http://localhost:3002/api/debug/test-evolution | jq . 2>/dev/null || curl -s http://localhost:3002/api/debug/test-evolution
echo ""
echo ""

echo "4. Configurando webhook para 'nowhats'..."
curl -X POST http://localhost:3002/api/whatsapp/setup-webhook/nowhats \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-id" \
  -d '{"userId": "test-user-id"}' | jq . 2>/dev/null || curl -X POST http://localhost:3002/api/whatsapp/setup-webhook/nowhats \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-id" \
  -d '{"userId": "test-user-id"}'
echo ""
echo ""

echo "✅ Teste concluído!"