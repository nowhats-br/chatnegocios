# DOCKERFILE SIMPLES - SEM PROXY - SOLUÇÃO DEFINITIVA
FROM node:18-alpine

WORKDIR /app

# Instalar dependências mínimas
RUN apk add --no-cache wget

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --no-audit --no-fund

# Copiar código
COPY . .

# Build do frontend
RUN npm run build:fast

# Usuário não-root
RUN adduser -D appuser
USER appuser

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001

CMD ["node", "server/app.simple.cjs"]