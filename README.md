Chat Negócios — Deploy Bare‑Metal (Nginx + Backend + Frontend)

Visão geral
-----------
Este projeto não usa mais Docker nem Traefik. O deployment recomendado é bare‑metal com Nginx, Node.js e (opcionalmente) PostgreSQL, utilizando o instalador interativo.

Pré‑requisitos
--------------
- Ubuntu/Debian com acesso root (sudo).
- Node.js 20+ e Nginx (o instalador cuida disso).
- DNS apontando para o servidor:
  - Domínio do frontend (ex.: `app.seudominio.com`).
  - Domínio do backend/API (ex.: `api.seudominio.com`).
- Portas `80` e `443` liberadas no firewall/NAT.

Instalação
----------
1) Faça clone do repositório e acesse a pasta do projeto.
2) Execute o instalador:
   - `sudo bash scripts/install-baremetal.sh`
3) Responda aos prompts:
   - Domínio do frontend.
   - Domínio do backend/API.
   - Habilitar SSL (Let’s Encrypt) e e‑mail para Certbot.
4) O instalador irá:
   - Instalar/validar Node.js, Nginx e PostgreSQL.
   - Criar/atualizar `.env` com `CORS_ORIGINS` e `VITE_BACKEND_URL` corretos.
   - Buildar o frontend e publicar em `WEBROOT`.
   - Configurar `systemd` para o backend (`chatnegocios.service`).
   - Escrever configuração Nginx para frontend e API.
   - Emitir certificados para os domínios informados (se SSL habilitado).

Variáveis de ambiente
---------------------
- Backend
  - `PORT` — porta do backend Express.
  - `DATABASE_URL` — conexão Postgres.
  - `CORS_ORIGINS` — origens permitidas (ex.: `https://app.seudominio.com`).
- Frontend
  - `VITE_BACKEND_URL` — URL pública do backend (ex.: `https://api.seudominio.com/api`).
- Evolution API
  - `VITE_EVOLUTION_API_URL`, `VITE_EVOLUTION_API_KEY`
  - `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE`, `VITE_EVOLUTION_WEBHOOK_URL`
- Atualização via UI (Admin)
  - `ENABLE_UI_UPDATE`, `GITHUB_REPO`, `GITHUB_BRANCH`, `AUTO_RESTART_ON_UPDATE`

Validação
---------
- Frontend: `https://<domínio-frontend>` deve carregar a aplicação.
- Backend: `https://<domínio-backend>/api/auth/me` deve responder com JSON.
- Nginx: `sudo nginx -t` e `sudo systemctl status nginx`.
- Backend: `sudo systemctl status chatnegocios`.

Troubleshooting
---------------
- DNS: confirme resolução dos domínios com `nslookup`/`dig` apontando para o IP do servidor.
- Firewall: libere 80/443 (`sudo ufw allow 80,443/tcp`).
- Certbot: verifique logs em `/var/log/letsencrypt/letsencrypt.log`.
- Conflitos Nginx: remova site padrão (`/etc/nginx/sites-enabled/default`) se necessário.

Notas
-----
- Arquivos e instruções de Docker/Traefik foram removidos.
- Para deploy em containers, crie Dockerfiles e compose próprios conforme sua infraestrutura.
