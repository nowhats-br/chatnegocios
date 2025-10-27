# Dockerfile ultra-otimizado para deploy rápido
FROM node:18-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat wget

WORKDIR /app

# Stage 1: Dependências de produção
FROM base AS deps-prod
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund --prefer-offline

# Stage 2: Dependências de desenvolvimento + build
FROM base AS builder
COPY package*.json ./
RUN npm ci --no-audit --no-fund --prefer-offline

# Copiar código fonte
COPY . .

# Build otimizado
RUN npm run build:fast

# Stage 3: Imagem final mínima
FROM node:18-alpine AS runner

# Instalar wget para healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copiar apenas o necessário
COPY --from=deps-prod --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/server ./server
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Mudar para usuário não-root
USER appuser

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS="--max-old-space-size=512"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Comando de inicialização
CMD ["node", "server/app.cjs"]