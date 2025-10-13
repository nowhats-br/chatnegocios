# syntax=docker/dockerfile:1.4
# Multi-stage build for single-app deployment in EasyPanel

FROM node:18-alpine AS builder
WORKDIR /app

# Copy package manifests first for better layer caching
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build frontend loading Vite envs via BuildKit secret
RUN --mount=type=secret,id=vite_env \
    export $(grep -v '^#' /run/secrets/vite_env | xargs) && \
    npx tsc && npm run build


FROM node:18-alpine AS runner
WORKDIR /app

# Copy only what's needed to run
COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --production

COPY server ./server
COPY --from=builder /app/dist ./dist

# Runtime envs for webhook and server
ENV PORT=3000
ENV WEBHOOK_PORT=3000
ENV WEBHOOK_PATH=/api/evolution/webhook

EXPOSE 3000
CMD ["node", "server/app.cjs"]