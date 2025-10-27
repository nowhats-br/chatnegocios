# 📁 Guia dos Arquivos de Deploy

## 🎯 Arquivos Principais (USE ESTES)

### **1. `Dockerfile`** ⭐ PRINCIPAL
- **Uso**: Deploy no EasyPanel, Docker, qualquer plataforma
- **Otimizado**: Single-stage, ultra-rápido
- **Tempo**: 1.5-3 minutos de build
- **Tamanho**: ~150MB

### **2. `docker-compose.yml`** 
- **Uso**: Desenvolvimento local e teste
- **Comando**: `docker-compose up --build`
- **Inclui**: Health check e variáveis de ambiente

### **3. `easypanel.yml`**
- **Uso**: Configuração específica do EasyPanel (YAML)
- **Opcional**: Apenas se quiser configuração avançada
- **Inclui**: Recursos, health check, variáveis

### **4. `deploy/easypanel-config.json`**
- **Uso**: Configuração alternativa em JSON
- **Opcional**: Para quem prefere JSON ao invés de YAML
- **Mesmo conteúdo**: Só formato diferente

## 🚀 Como Usar no EasyPanel

### **Método 1: Simples (Recomendado)**
1. Conecte seu repositório Git no EasyPanel
2. EasyPanel detecta automaticamente o `Dockerfile`
3. Configure as variáveis de ambiente:
   ```env
   NODE_ENV=production
   PORT=3001
   CORS_ALLOW_ALL=true
   EVOLUTION_API_URL=https://evolution.nowhats.com.br
   EVOLUTION_API_KEY=sua-chave
   ```
4. Deploy automático!

### **Método 2: Com Docker Compose**
1. No EasyPanel, escolha "Docker Compose"
2. Use o arquivo `docker-compose.yml`
3. Configure as variáveis no arquivo `.env`

### **Método 3: Configuração Avançada**
1. Use o `easypanel.yml` para configuração completa
2. Inclui recursos, health check, etc.

## 📋 Checklist de Deploy

- [ ] ✅ **Dockerfile** na raiz (principal)
- [ ] ✅ **.dockerignore** configurado
- [ ] ✅ **Variáveis de ambiente** definidas
- [ ] ✅ **Port 3001** configurado
- [ ] ✅ **Health check**: `/api/health`

## 📁 Arquivos Relacionados (NÃO são duplicados)

- ✅ `easypanel.yml` - Configuração YAML (na raiz)
- ✅ `deploy/easypanel-config.json` - Configuração JSON (alternativa)

## 🗑️ Arquivos Removidos (Duplicados)

- ❌ `Dockerfile.fast` - Era duplicado
- ❌ `easypanel-deploy.yml` - Era duplicado

## 🎯 Resultado

**Um único Dockerfile otimizado** que funciona em qualquer plataforma:
- EasyPanel ✅
- Docker ✅  
- Heroku ✅
- Railway ✅
- Render ✅
- Qualquer plataforma Docker ✅

**Deploy em 1.5-3 minutos** vs 10-15 minutos anterior!