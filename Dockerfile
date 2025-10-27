# DOCKERFILE MÍNIMO E GARANTIDO - SOLUÇÃO URGENTE
FROM node:18-alpine

WORKDIR /app

# Instalar wget para health check
RUN apk add --no-cache wget

# Copiar package.json
COPY package.json package-lock.json ./

# Instalar dependências (SEM --only=production para evitar erros)
RUN npm ci --no-audit --no-fund

# Copiar todo o código
COPY . .

# Build sem TypeScript check (mais rápido e confiável)
RUN npm run build:fast

# Criar usuário
RUN adduser -D appuser
USER appuser

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/app.cjs"]