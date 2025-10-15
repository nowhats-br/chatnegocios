# ChatNegócios – Guia de Configuração

Este projeto integra um frontend (Vite/React) com um backend Express e a Evolution API para criar e gerenciar "connections" (instâncias) e processar mensagens via webhook. O armazenamento das connections agora é feito em PostgreSQL. Supabase não é mais utilizado para CRUD de connections.

## Visão Geral

- Backend em `server/app.cjs` expõe:
  - `GET /api/connections`: Lista connections.
  - `POST /api/connections`: Cria uma connection (apenas metadados; a criação de instância Evolution é feita no frontend via API Evolution).
  - `PATCH /api/connections/:id/status`: Atualiza status da connection.
  - `DELETE /api/connections/:id`: Remove connection.
  - Webhook em `WEBHOOK_PATH` (recebe mensagens da Evolution API).
- Frontend consome os endpoints acima (vide `src/pages/Connections.tsx`).
- Banco de dados: PostgreSQL via `DATABASE_URL`.

## Variáveis de Build (Vite)

- `VITE_EVOLUTION_API_URL`: URL base da Evolution API.
- `VITE_EVOLUTION_API_KEY`: Chave da Evolution API.
- `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE`: Template do endpoint para QR (ex.: `{{base}}/instances/{{instance}}/qr`).
- `VITE_EVOLUTION_WEBHOOK_URL`: URL pública do webhook (usada pela Evolution para enviar mensagens).

## Variáveis de Runtime

- `PORT`: Porta do servidor principal (Express).
- `WEBHOOK_PATH`: Caminho do webhook (ex.: `/api/evolution/webhook`).
- `DATABASE_URL`: URL de conexão PostgreSQL (ex.: `postgres://user:pass@host:5432/dbname`).

Em produção, recomenda-se `sslmode=require` caso o provedor exija TLS: `postgres://.../?sslmode=require`.

## Docker Compose

O `docker-compose.yml` inclui a variável `DATABASE_URL` no serviço da aplicação para conectar ao banco. Exemplo de bloco de variáveis:

```
environment:
  # Build Args (Vite)
  VITE_EVOLUTION_API_URL: "https://api.evolution.com"
  VITE_EVOLUTION_API_KEY: "sua-chave"
  VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE: "{{base}}/instances/{{instance}}/qr"
  VITE_EVOLUTION_WEBHOOK_URL: "https://sua-url-publica.com/webhook"

  # Runtime
  PORT: "3000"
  WEBHOOK_PATH: "/api/evolution/webhook"
  DATABASE_URL: "postgres://user:pass@db:5432/app"
```

Certifique-se de que o serviço de banco (`db`) está configurado e acessível pela aplicação.

## Supabase (Opcional)

- As operações de listar, criar, atualizar status e excluir connections foram migradas para o backend Express com PostgreSQL.
- O projeto mantém integração opcional com Supabase para alguns recursos do frontend (ex.: Kanban, etiquetas, filas, respostas rápidas). Caso não configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o app utiliza um stub local sem persistência para essas áreas.
- As variáveis do Supabase foram removidas de `.env.example`. Configure-as apenas se precisar de persistência via Supabase para esses recursos.

## Desenvolvimento

- Instale dependências do servidor (inclui `pg` para PostgreSQL) e do frontend.
- Inicie o servidor e o frontend conforme seus scripts (ex.: `npm run dev`), ou via Docker (`docker compose up -d --build`).
- Ajuste `.env`/variáveis de ambiente conforme as seções acima.

Observações:
- Scripts podem variar conforme seu `package.json`. Caso utilize apenas Docker, os containers subirão o servidor e servirão a SPA automaticamente.
- O webhook exige uma URL pública (`VITE_EVOLUTION_WEBHOOK_URL`) para que a Evolution API entregue eventos.

## Segurança e Produção

- Use `DATABASE_URL` seguro e credenciais com privilégios mínimos.
- Se expor o webhook, proteja o endpoint e valide assinaturas quando aplicável.
- Configure logs e monitoramento para o servidor Express.