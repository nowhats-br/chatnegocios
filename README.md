Chat Negócios — Deploy (Traefik + Backend + Frontend)

Visão geral
-----------
- Stack em Docker com Traefik (SSL/ACME), ChatNegócios Backend e Frontend, e Postgres opcional.
- Instaladores foram removidos; o deploy agora é feito via docker compose ou docker swarm com os arquivos da pasta `scripts`.

Pré‑requisitos
--------------
- DNS com registros válidos para seus domínios públicos:
  - `CHATNEGOCIOS_DOMAIN` (frontend) — ex.: `chatvendas.nowhats.com.br`
  - `CHATNEGOCIOS_API_DOMAIN` (backend) — ex.: `back.nowhats.com.br`
- Porta `80` e `443` liberadas no firewall/NAT para o Traefik.
- Redes Docker criadas (se ainda não existirem):
  - `docker network create chatnegocios`
  - `docker network create app_net`

SSL via Cloudflare (DNS‑01)
--------------------------
- Gere um token na Cloudflare com escopos restritos à sua zona:
  - Permissões: `Zone.DNS:Edit` e `Zone.Zone:Read`
  - Zona: a específica do seu domínio (ex.: `nowhats.com.br`)
- Defina variáveis de ambiente antes do deploy do Traefik:
  - PowerShell: `$env:ACME_EMAIL="seu-email@dominio.com"; $env:CF_API_TOKEN="SEU_TOKEN_CLOUDFLARE"`
  - Bash: `export ACME_EMAIL="seu-email@dominio.com"; export CF_API_TOKEN="SEU_TOKEN_CLOUDFLARE"`
- O Traefik já está configurado para DNS‑01 Cloudflare em `scripts/traefik-compose.yml`.

Build das imagens
-----------------
- Backend:
  - `docker build -t chatnegocios-backend:latest -f Dockerfile.backend .`
- Frontend (injete a URL pública do backend):
  - `docker build -t chatnegocios-frontend:latest -f Dockerfile.frontend --build-arg VITE_BACKEND_URL=https://<CHATNEGOCIOS_API_DOMAIN> .`

Deploy
------
- Traefik:
  - Compose: `docker compose -f scripts/traefik-compose.yml up -d`
  - Swarm: `docker stack deploy -c scripts/traefik-compose.yml traefik`
- Postgres (opcional):
  - Compose: `docker compose -f scripts/postgres-compose.yml up -d`
  - Swarm: `docker stack deploy -c scripts/postgres-compose.yml chatdb`
- ChatNegócios (frontend + backend):
  - Defina variáveis usadas nos labels do Traefik:
    - PowerShell: `$env:CHATNEGOCIOS_DOMAIN="chatvendas.nowhats.com.br"; $env:CHATNEGOCIOS_API_DOMAIN="back.nowhats.com.br"`
    - Bash: `export CHATNEGOCIOS_DOMAIN="chatvendas.nowhats.com.br"; export CHATNEGOCIOS_API_DOMAIN="back.nowhats.com.br"`
  - Compose: `docker compose -f scripts/chatnegocios-compose.yml up -d`
  - Swarm: `docker stack deploy -c scripts/chatnegocios-compose.yml chatnegocios`

Variáveis de ambiente (serviços)
--------------------------------
- Backend (`scripts/chatnegocios-compose.yml`):
  - `DATABASE_URL` — conexão Postgres (ex.: `postgres://user:pass@host:5432/dbname`). Se ausente, usa banco em memória (pg-mem).
  - `CORS_ORIGINS` — origens permitidas separadas por vírgula (ex.: `https://chatvendas.nowhats.com.br`).
- Traefik (`scripts/traefik-compose.yml`):
  - `ACME_EMAIL` — email para Let’s Encrypt.
  - `CF_API_TOKEN` — token Cloudflare para DNS‑01.

Validações rápidas
------------------
- Traefik: `docker logs traefik --since 5m` e verifique emissão de certificados.
- Rotas TLS:
  - Frontend: `https://<CHATNEGOCIOS_DOMAIN>`
  - Backend: `https://<CHATNEGOCIOS_API_DOMAIN>`
- Teste rápido: `curl -I https://<domínio>` deve retornar `HTTP/2 200` e certificado válido da Let’s Encrypt.

Troubleshooting
---------------
- Certificados:
  - Token inválido ou escopo incorreto na Cloudflare causa falha no desafio DNS.
  - Verifique logs com `docker logs traefik --since 10m | findstr /i acme` (Windows) ou `grep -i acme` (Linux).
- DNS:
  - Confirme resolução: `dig +short <CHATNEGOCIOS_DOMAIN>` e `<CHATNEGOCIOS_API_DOMAIN>` apontando para o IP do servidor.
- Frontend SPA:
  - O Nginx do frontend já está com fallback SPA (`scripts/nginx.conf`).

Notas
-----
- Evolution e instaladores foram removidos do projeto.
- Para ambientes com Cloudflare proxy (nuvem laranja), DNS‑01 funciona normalmente.
- Se preferir HTTP‑01, reconfigure Traefik (desabilite DNS‑01 e habilite httpchallenge, com porta 80 pública e proxy desligado temporariamente).