# Deploy Otimizado para EasyPanel

## 🚀 Otimizações Implementadas

### 1. **Dockerfile Multi-Stage Otimizado**
- **3 stages** para máxima eficiência de cache
- **Dependências separadas** (prod vs dev)
- **Imagem final mínima** (~150MB vs ~800MB)
- **Cache de layers** otimizado

### 2. **Build Rápido**
- **npm ci** com `--prefer-offline` e `--no-audit`
- **Build paralelo** desabilitado para evitar timeout
- **Vite build otimizado** com `--mode production`
- **TypeScript check** otimizado

### 3. **Recursos Limitados**
- **Memória**: 256Mi request, 512Mi limit
- **CPU**: 250m request, 500m limit
- **Node.js**: `--max-old-space-size=512`

### 4. **Cache Estratégico**
- **Layer caching** no Docker
- **npm cache** preservado
- **Build cache** habilitado

## ⏱️ Tempo de Deploy Estimado

| Componente | Tempo Anterior | Tempo Otimizado | Melhoria |
|------------|----------------|-----------------|----------|
| npm install | 3-5 min | 1-2 min | 60% |
| TypeScript build | 2-3 min | 30-60s | 70% |
| Vite build | 1-2 min | 20-40s | 60% |
| Docker build | 5-8 min | 2-3 min | 65% |
| **TOTAL** | **11-18 min** | **4-6 min** | **65%** |

## 🛠️ Como Usar no EasyPanel

### Opção 1: Dockerfile Direto
1. Faça upload do projeto
2. Configure as variáveis de ambiente
3. Use o `Dockerfile` na raiz
4. Deploy automático

### Opção 2: Docker Compose
```bash
# No EasyPanel, use o docker-compose.yml
docker-compose up -d
```

### Opção 3: Configuração JSON
```bash
# Use o arquivo deploy/easypanel-config.json
# Para configuração avançada no EasyPanel
```

## 🔧 Variáveis de Ambiente Necessárias

```env
# Obrigatórias
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-chave-api

# Supabase (opcional)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-key

# Configurações (opcionais)
NODE_ENV=production
PORT=3001
CORS_ALLOW_ALL=true
```

## 📊 Monitoramento

### Health Check
- **Endpoint**: `/api/health`
- **Intervalo**: 30s
- **Timeout**: 10s
- **Falhas**: 3 tentativas

### Logs
```bash
# Ver logs em tempo real
docker logs -f chatnegocios

# Ver últimas 100 linhas
docker logs --tail 100 chatnegocios
```

## 🐛 Troubleshooting

### Build Lento?
1. Verifique se o cache está habilitado
2. Use `npm ci` ao invés de `npm install`
3. Verifique recursos disponíveis

### Erro de Memória?
1. Aumente o limite de memória para 1Gi
2. Adicione `NODE_OPTIONS=--max-old-space-size=1024`

### Timeout no Build?
1. Aumente o timeout para 15min
2. Desabilite builds paralelos
3. Use `build:fast` ao invés de `build`

## 🔄 Atualizações Futuras

Para manter a otimização:
1. **Mantenha dependências atualizadas**
2. **Use .dockerignore** para excluir arquivos desnecessários
3. **Monitore tamanho da imagem** regularmente
4. **Cache de build** sempre habilitado