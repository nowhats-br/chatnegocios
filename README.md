Chat Negócios — Instalação Profissional (Infra, Evolution, ChatNegocios)

Visão geral
-----------
- Stack em Docker com Traefik (SSL/ACME), Evolution API (Postgres + Redis) e ChatNegocios (backend + frontend + Postgres).
- Instalação separada por etapas, sem reinstalar a Evolution ao instalar o ChatNegocios.

Pré‑requisitos
--------------
- DNS com registros válidos:
  - `EVOLUTION_DOMAIN` (A/AAAA para o IP do servidor)
  - `CHATNEGOCIOS_DOMAIN` (A/AAAA para o IP do servidor)
  - `api.<CHATNEGOCIOS_DOMAIN>` (CNAME para `CHATNEGOCIOS_DOMAIN` ou A/AAAA próprio)
- Porta 80/443 liberadas no firewall para o Traefik emitir e servir certificados.

Instalação (produção)
---------------------
1) Infraestrutura (Traefik + redes + Portainer)
   - `ACME_EMAIL=suporte@nowhats.com.br sudo -E bash scripts/install-infra.sh`

2) Evolution API (Postgres + Redis)
   - `EVOLUTION_DOMAIN=evoapi.nowhats.com.br sudo -E bash scripts/install-evolution.sh`
   - Ao final, copie a chave impressa: `AUTHENTICATION_API_KEY`.

3) ChatNegocios (Postgres + backend + frontend)
   - `CHATNEGOCIOS_DOMAIN=chatvendas.nowhats.com.br sudo -E bash scripts/install-chatnegocios.sh`
   - O instalador lê `EVOLUTION_DOMAIN` e `VITE_EVOLUTION_API_KEY` de `.env.evolution` e não toca na Evolution.

Validações rápidas
------------------
- Traefik: `docker logs traefik | tail -n 200` e verifique emissão de certificado para os domínios.
- Evolution:
  - `docker logs evolution_api | tail -n 200`
  - Acesse `https://evoapi.nowhats.com.br/docs` (ou `api-docs`) e verifique resposta HTTP 200.
- ChatNegocios:
  - Frontend: `https://chatvendas.nowhats.com.br`
  - Backend: `https://api.chatvendas.nowhats.com.br`
  - Webhook Evolution: `https://api.chatvendas.nowhats.com.br/api/whatsapp/webhook`

Observações sobre Redis (Evolution v2)
-------------------------------------
- Redis é usado para cache. O compose já provisiona `evolution_redis` e exporta as variáveis:
  - `CACHE_REDIS_ENABLED=true`, `CACHE_REDIS_URI=redis://evolution_redis:6379/6`, `CACHE_REDIS_TTL=604800`.
- Se persistirem erros de "redis disconnected":
  - Verifique rede: `docker exec evolution_api ping -c1 evolution_redis` e `nc -vz evolution_redis 6379`.
  - Verifique saúde: `docker ps` e `docker logs evolution_redis | tail -n 200`.
  - Como workaround temporário: desabilite Redis e habilite cache local (editar `scripts/evolution-compose.yml`):
    - `CACHE_REDIS_ENABLED=false`, `CACHE_LOCAL_ENABLED=true`.

Webhook (destino)
-----------------
- Configure `VITE_EVOLUTION_WEBHOOK_URL` apontando para o seu backend público (POST).
- Não aponte o webhook para a própria Evolution; o destino é o seu serviço.

Ambiente (.env)
---------------
- Use `.env.example` como base; ajuste backend, frontend e Evolution conforme seu ambiente.
- Em desenvolvimento, use `http://localhost` e habilite um túnel (ngrok/Cloudflared) para testar webhooks.

Troubleshooting
---------------
- Certificados:
  - Se usar Cloudflare, desative o proxy (laranja) durante o HTTP‑01 até o Traefik concluir a validação.
- DNS:
  - Confirme resolução: `dig +short evoapi.nowhats.com.br`, `dig +short chatvendas.nowhats.com.br`, `dig +short api.chatvendas.nowhats.com.br`.
- Rotas Traefik:
  - Os serviços têm `traefik.docker.network=proxy` e rodam em `websecure` (443).

Atualizações e reimplantação
----------------------------
- Para aplicar mudanças nos composes:
  - `docker compose -f scripts/evolution-compose.yml --env-file .env.evolution up -d --remove-orphans`
  - `docker compose -f scripts/chatnegocios-compose.yml --env-file .env.chatnegocios up -d --remove-orphans`