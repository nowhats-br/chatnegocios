# 🔧 Teste Rápido do Webhook

## 1. Primeiro, certifique-se de que o servidor está rodando:
```bash
npm run start:websocket
```

## 2. Em outro terminal, teste cada endpoint:

### Teste 1: Comunicação básica
```bash
curl http://localhost:3002/api/test/ping
```
**Esperado:** `{"success":true,"message":"Pong! Servidor funcionando","timestamp":"..."}`

### Teste 2: Configuração
```bash
curl http://localhost:3002/api/debug/webhook-config
```
**Esperado:** Dados de configuração da Evolution API

### Teste 3: Evolution API
```bash
curl http://localhost:3002/api/debug/test-evolution
```
**Esperado:** `{"success":true,"message":"Conexão com Evolution API estabelecida com sucesso"}`

### Teste 4: Configurar Webhook
```bash
curl -X POST http://localhost:3002/api/whatsapp/setup-webhook/nowhats -H "Content-Type: application/json" -H "x-user-id: test-user-id" -d "{\"userId\": \"test-user-id\"}"
```
**Esperado:** `{"success":true,"message":"Webhook configurado com sucesso"}`

## 3. Ou use o botão 🔧 na interface web

Na página de Atendimentos, clique no botão 🔧 (debug) no header e observe os logs no console do navegador.

## 4. Verificar logs do servidor

Observe os logs detalhados no terminal onde o servidor está rodando para identificar exatamente onde está falhando.