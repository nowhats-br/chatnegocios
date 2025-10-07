# Multi-stage build for single-app deployment in EasyPanel

FROM node:18-alpine AS build
WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json* ./

# Build-time environment for Vite (injected into bundle)
ARG VITE_SUPABASE_URL=https://rtjxkjluufgfqguoeinn.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anhramx1dWZnZnFndW9laW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTMwMTIsImV4cCI6MjA3NDcyOTAxMn0.mlZuJLhMUQGeQC0CPIqrFSr1CFC2dA8Muhdpw08cidI
ARG VITE_EVOLUTION_API_URL=https://evo.nowhats.com.br
ARG VITE_EVOLUTION_API_KEY=XZ3calYj8iGSF0KxuSQvAwkXFZVDMQjn
ARG VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE
ARG VITE_EVOLUTION_WEBHOOK_URL=https://chat.nowhats.com.br/api/evolution/webhook

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_EVOLUTION_API_URL=${VITE_EVOLUTION_API_URL}
ENV VITE_EVOLUTION_API_KEY=${VITE_EVOLUTION_API_KEY}
ENV VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE=${VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE}
ENV VITE_EVOLUTION_WEBHOOK_URL=${VITE_EVOLUTION_WEBHOOK_URL}

# Install deps and build frontend
RUN npm ci
COPY . .
RUN npm run build


FROM node:18-alpine AS runner
WORKDIR /app

# Copy only what's needed to run
COPY package.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

# Runtime envs for webhook and server
ENV PORT=3000
ENV WEBHOOK_PORT=3000
ENV WEBHOOK_PATH=/api/evolution/webhook

EXPOSE 3000
CMD ["node", "server/app.js"]