# Dockerfile EXTREMAMENTE OTIMIZADO para EasyPanel
FROM node:18-alpine

WORKDIR /app

# Instalar dependências de sistema mínimas
RUN apk add --no-cache wget

# Cache layer: package.json primeiro
COPY package*.json ./

# Instalar APENAS produção, sem logs
RUN npm ci --only=production --silent --no-audit --no-fund --no-optional

# Copiar código e build
COPY . .
RUN npm run build:ultra

# Limpeza agressiva para reduzir tamanho
RUN rm -rf src .git* *.md scripts deploy .kiro .vscode .storybook tsconfig* vite.config* vitest.config* eslint.config* tailwind.config* postcss.config* \
    && npm cache clean --force

# Usuário não-root
RUN adduser -D appuser
USER appuser

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001 \
    NODE_OPTIONS="--max-old-space-size=256"

CMD ["node", "server/app.cjs"]