# 🔧 Guia de Troubleshooting - WebSocket e Webhooks

## ❌ Problema: "Erro ao configurar webhook para nowhats"

### 🔍 Passos para Diagnosticar:

1. **Verificar Configuração da Evolution API:**
   - Clique no botão 🔧 (debug) no header da página de Atendimentos
   - Verifique se a Evolution API está respondendo
   - Confirme se as credenciais estão corretas

2. **Verificar Logs do Servidor:**
   ```bash
   # Inicie o servidor e observe os logs
   npm run start:websocket
   ```

3. **Verificar Variáveis de Ambiente:**
   ```bash
   # Certifique-se de que estas variáveis estão definidas:
   EVOLUTION_API_URL=https://sua-evolution-api.com
   EVOLUTION_API_KEY=sua-chave-da-api
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```

### 🛠️ Soluções Comuns:

#### 1. **Evolution API não configurada:**
```bash
# Verifique se as variáveis estão definidas no .env
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-chave-da-api
```

#### 2. **URL do webhook incorreta:**
```bash
# Se estiver em produção, defina a URL base:
WEBHOOK_BASE_URL=https://seu-dominio.com
```

#### 3. **Instância não existe na Evolution API:**
- Verifique se a instância "nowhats" existe na Evolution API
- Acesse: `https://sua-evolution-api.com/manager/findInstances`
- Se não existir, crie a instância primeiro

#### 4. **Problemas de CORS:**
```bash
# Adicione seu domínio às origens permitidas:
CORS_ORIGINS=https://seu-dominio.com,http://localhost:5173
```

### 🧪 Testes Manuais:

#### 1. **Testar Evolution API diretamente:**
```bash
curl -X GET "https://sua-evolution-api.com/manager/findInstances" \
  -H "apikey: sua-chave-da-api" \
  -H "Content-Type: application/json"
```

#### 2. **Testar configuração do webhook:**
```bash
curl -X POST "http://localhost:3001/api/whatsapp/setup-webhook/nowhats" \
  -H "Content-Type: application/json" \
  -H "x-user-id: seu-user-id" \
  -d '{"userId": "seu-user-id"}'
```

#### 3. **Testar webhook endpoint:**
```bash
curl -X POST "http://localhost:3001/api/whatsapp/webhook?uid=seu-user-id" \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "nowhats",
    "event": "messages.upsert",
    "data": {
      "messages": [{
        "key": {"id": "test", "remoteJid": "5511999999999@s.whatsapp.net"},
        "message": {"conversation": "Teste"},
        "pushName": "Teste"
      }]
    }
  }'
```

### 📋 Checklist de Verificação:

- [ ] Evolution API URL está correta e acessível
- [ ] Evolution API Key está correta
- [ ] Supabase está configurado corretamente
- [ ] Instância WhatsApp existe na Evolution API
- [ ] Instância WhatsApp está conectada (status: CONNECTED)
- [ ] Servidor WebSocket está rodando na porta correta
- [ ] Variáveis de ambiente estão definidas
- [ ] CORS está configurado para seu domínio

### 🚀 Fluxo Correto de Funcionamento:

1. **Usuário conecta WhatsApp** → Status muda para "CONNECTED"
2. **Sistema configura webhook automaticamente** → Evolution API recebe configuração
3. **Mensagem chega no celular** → Evolution API envia para webhook
4. **Backend processa mensagem** → Salva no Supabase
5. **Backend notifica via WebSocket** → Frontend recebe em tempo real
6. **Interface atualiza** → Conversa aparece em "Aguardando"

### 📞 Suporte:

Se o problema persistir:
1. Ative os logs de debug no servidor
2. Capture os logs completos
3. Verifique a documentação da Evolution API
4. Teste cada componente individualmente