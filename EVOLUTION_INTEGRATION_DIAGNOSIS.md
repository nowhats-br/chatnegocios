# Diagnóstico da Integração Evolution API

## Problema Identificado

O sistema está configurado para usar **PROXY** (`VITE_EVOLUTION_USE_PROXY=true`), mas há uma **inconsistência na configuração**.

## Configuração Atual

### ✅ Backend (.env)
```
EVOLUTION_API_URL=https://evolution.nowhats.com.br  ✅ CORRETO
EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11  ✅ CORRETO
```

### ✅ Frontend (.env)
```
VITE_EVOLUTION_USE_PROXY=true  ✅ CORRETO (usando proxy)
VITE_BACKEND_URL=https://evochat.nowhats.com.br  ✅ CORRETO (seu backend)
```

## Como Funciona com Proxy

1. **Frontend** → `https://evochat.nowhats.com.br/api/evolution/*`
2. **Backend** → `https://evolution.nowhats.com.br/*`

## Problema na Página de Configurações

A página de **Configurações** está pedindo para o usuário inserir:
- URL da Evolution API
- Chave da Evolution API

**MAS** quando `VITE_EVOLUTION_USE_PROXY=true`, essas configurações **NÃO DEVERIAM SER NECESSÁRIAS** porque o backend já tem essas informações!

## Soluções Possíveis

### Opção 1: Corrigir a Página de Configurações (Recomendado)
- Quando proxy está habilitado, **não pedir** URL/Key do usuário
- Usar as configurações do backend automaticamente
- Mostrar apenas status da conexão

### Opção 2: Desabilitar o Proxy
- Mudar `VITE_EVOLUTION_USE_PROXY=false`
- Permitir que usuário configure diretamente

### Opção 3: Configuração Híbrida
- Permitir override das configurações do backend

## Teste de Diagnóstico

Para testar se o backend está funcionando:
1. Acesse: `https://evochat.nowhats.com.br/api/evolution/manager/findInstances`
2. Deveria retornar dados da Evolution API

## Correção Recomendada

Vou implementar a **Opção 1**: Corrigir a página de configurações para funcionar corretamente com proxy.