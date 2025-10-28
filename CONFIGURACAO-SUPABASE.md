# 🔧 Configuração do Supabase

## Passo a Passo

### 1. Configure as credenciais do Supabase

Execute o script de configuração interativo:

```bash
node configure-supabase.cjs
```

### 2. Onde encontrar as credenciais

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** (URL do projeto)
   - **anon/public key** (chave pública)
   - **service_role key** (chave de serviço - opcional)

### 3. Teste a conexão

Após configurar, teste se está funcionando:

```bash
node test-supabase.cjs
```

### 4. Configuração manual (alternativa)

Se preferir configurar manualmente, edite o arquivo `.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://seu-projeto-id.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Frontend Configuration
VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## ⚠️ Importante

- **Nunca** compartilhe a `service_role key` publicamente
- A `anon key` é segura para uso no frontend
- Reinicie o servidor após alterar as configurações

## 🔍 Solução de Problemas

### Erro de conexão
- Verifique se a URL está correta
- Confirme se as chaves estão corretas
- Teste a conexão com `node test-supabase.cjs`

### Login não funciona
- Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão definidas
- Confirme se o projeto Supabase tem autenticação habilitada

### Banco de dados não conecta
- Verifique se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão definidas
- Confirme se as políticas RLS estão configuradas corretamente