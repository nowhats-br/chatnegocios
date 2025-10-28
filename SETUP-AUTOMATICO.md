# 🚀 Configuração Automática do Sistema WebSocket

## ⚡ Configuração Rápida (1 comando)

```bash
npm run fix:webhook
```

Este comando vai:
- ✅ Verificar todas as dependências
- ✅ Criar arquivos de configuração necessários
- ✅ Corrigir problemas automaticamente
- ✅ Mostrar o que precisa ser feito

## 🔧 Configurar Credenciais

1. **Abra o arquivo `.env` que foi criado**
2. **Configure suas credenciais:**

```env
# Evolution API Configuration
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-chave-da-api

# Supabase Configuration  
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## 🚀 Iniciar Sistema

```bash
npm run setup:webhook
```

Este comando vai:
- ✅ Encontrar uma porta livre automaticamente
- ✅ Iniciar o servidor WebSocket
- ✅ Configurar tudo automaticamente

## 🌐 Usar o Sistema

1. **Acesse:** http://localhost:5173
2. **Vá para:** Página de Atendimentos
3. **Clique no botão 🚀** no header (auto-configuração)
4. **Pronto!** O sistema vai configurar tudo automaticamente

## 🔍 Se Algo Der Errado

### Problema: Servidor não inicia
```bash
# Verificar e corrigir problemas
npm run fix:webhook

# Tentar novamente
npm run setup:webhook
```

### Problema: "Evolution API não configurada"
1. Edite o arquivo `.env`
2. Configure `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`
3. Reinicie o servidor

### Problema: "Nenhuma conexão ativa"
1. Vá para a página de Conexões
2. Conecte uma instância do WhatsApp
3. Volte para Atendimentos e clique no botão 🚀

## 📋 Comandos Disponíveis

```bash
# Diagnosticar e corrigir problemas
npm run fix:webhook

# Configurar e iniciar sistema
npm run setup:webhook

# Apenas iniciar servidor (se já configurado)
npm run start:webhook

# Testar configuração
npm run test:webhook
```

## ✅ Sistema Funcionando

Quando tudo estiver funcionando, você verá:
- 🟢 **WebSocket** conectado no header
- 🚀 **Mensagens chegam automaticamente** na área "Aguardando"
- 🔔 **Notificações** quando novas mensagens chegam
- ⚡ **Tempo real** sem precisar atualizar a página

## 🆘 Suporte

Se ainda tiver problemas:
1. Execute `npm run fix:webhook`
2. Verifique os logs no terminal
3. Clique no botão 🚀 na interface
4. Observe os logs no console do navegador (F12)