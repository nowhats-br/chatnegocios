Chat Negócios — Configuração de Evolution API

Webhooks
---------
- O webhook da Evolution API deve apontar para um endpoint PÚBLICO seu, capaz de receber requisições HTTP (POST) e processar eventos (ex.: mensagens, atualização de conexão, QR code atualizado).
- Não use a URL do provedor da Evolution como webhook. Essa URL é a origem dos eventos, não o destino. O destino deve ser um serviço seu.
- Configure `VITE_EVOLUTION_WEBHOOK_URL` com a sua URL pública (ex.: `https://seu-dominio.com/api/evolution/webhook`). Em desenvolvimento, use um túnel (ngrok, Cloudflared) e aponte para esse endereço público.
- Se `VITE_EVOLUTION_WEBHOOK_URL` não estiver definida, a criação de instância enviará o webhook como desabilitado para evitar apontar incorretamente para `localhost`.

Diferença: URL base da API vs Webhook (destino)
-----------------------------------------------
- `VITE_EVOLUTION_API_URL` é a URL base do seu provedor Evolution (ex.: `https://api.nowhats.com.br`). É onde o app faz requisições para criar/gerar QR/etc.
- `VITE_EVOLUTION_WEBHOOK_URL` é a SUA URL pública que recebe os eventos via POST.
- Exemplo incorreto de webhook (não usar): `https://api.nowhats.com.br/api/evolution/webhook`.
- Exemplo correto de webhook: `https://seu-dominio.com/api/evolution/webhook` (ou URL de túnel em dev).

QR Code — Endpoint
------------------
- Provedores diferentes expõem o QR em rotas diferentes. Para adequar ao seu provedor, defina `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE` usando `{instanceName}` como placeholder.
- Exemplos válidos:
  - `/instance/qrCode/{instanceName}`
  - `/instance/connect/{instanceName}/qrcode`
- O app tentará primeiro o template configurado e depois fallbacks comuns. Se o QR retornar 404, ajuste o template conforme a documentação do seu provedor.

Variáveis de ambiente
---------------------
- `VITE_EVOLUTION_API_URL`: URL base da Evolution API do seu provedor (ex.: `https://api.nowhats.com.br`).
- `VITE_EVOLUTION_API_KEY`: Chave da API fornecida pelo seu provedor.
- `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE`: Template opcional para a rota do QR.
- `VITE_EVOLUTION_WEBHOOK_URL`: URL pública do seu endpoint receptor de webhooks.

Observações
-----------
- Reinicie o processo de desenvolvimento (`npm run dev`) após alterar o `.env`.
- Em produção, hospede o endpoint de webhook em um backend ou função serverless (Supabase Edge Functions, Cloudflare Workers, Express em Railway/Render, etc.).

Instalação em Ubuntu (produção)
-------------------------------
- Pré-requisitos: apontar DNS do seu domínio para o servidor Ubuntu e permitir portas 80/443.
- No servidor, execute:
  - `sudo apt-get update -y`
  - Clone ou copie este projeto para o servidor.
  - Configure `.env` com `VITE_EVOLUTION_API_URL` e `VITE_EVOLUTION_WEBHOOK_URL`.
  - Rode o instalador: `sudo bash scripts/install-ubuntu.sh`.
  - Informe o domínio (ex.: `atendimento.seudominio.com`) e e-mail para SSL.

O instalador faz:
- Instala Node LTS, Nginx, Certbot, PM2 e dependências.
- Constrói o frontend (`dist`) e configura Nginx para servir a SPA.
- Cria um backend mínimo de webhook em Node/Express e o gerencia com PM2.
- Emite certificado SSL via Let's Encrypt e ativa redirecionamento para HTTPS.

Após concluir, o script mostra:
- `URL de acesso`: `https://seu-dominio/`
- `Endpoint de webhook`: `https://seu-dominio/api/evolution/webhook`
- Caminhos de configuração (Nginx, PM2) e comandos úteis.

Lembrete:
- Use o mesmo endpoint em `VITE_EVOLUTION_WEBHOOK_URL` e no Manager Evolution (events/webhook).

Instalação via EasyPanel (1 App)
--------------------------------
- Objetivo: um único app que serve a SPA (frontend) e recebe webhooks no mesmo container.
- O EasyPanel cuidará de domínio e SSL. O container roda apenas HTTP (porta interna 3000).

Passo a passo
- Prepare o repositório (já está pronto):
  - `Dockerfile` multi-stage para build e execução.
  - `server/app.js` serve `dist` e expõe `WEBHOOK_PATH`.
  - Script de inicialização: `npm run start`.
- No EasyPanel:
  - Crie um novo App do tipo Dockerfile.
  - Aponte para este repositório e branch desejada.
  - Dockerfile path: `Dockerfile`.
  - Configure Build Args (usados na etapa de build do Vite):
    - `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
    - `VITE_SUPABASE_ANON_KEY`: Chave anon do Supabase.
    - `VITE_EVOLUTION_API_URL`: URL base do seu provedor Evolution.
    - `VITE_EVOLUTION_API_KEY`: Chave da API do provedor.
    - `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE`: opcional (ex.: `/instance/qrCode/{instanceName}`).
    - `VITE_EVOLUTION_WEBHOOK_URL`: `https://seu-dominio.com/api/evolution/webhook`.
  - Configure Environment (runtime):
    - `PORT`: `3000` (opcional; já definido no Dockerfile).
    - `WEBHOOK_PORT`: `3000` (opcional; já definido no Dockerfile).
    - `WEBHOOK_PATH`: `/api/evolution/webhook`.
  - Porta interna do container: `3000`.
  - Vincule o domínio ao app e ative SSL no EasyPanel.
  - Deploy (Build + Run).
- Após o deploy:
  - Acesse `https://seu-dominio.com/` para conferir a SPA.
  - Webhook público: `https://seu-dominio.com/api/evolution/webhook`.
  - Healthcheck: `https://seu-dominio.com/health`.

Notas importantes
- Variáveis `VITE_*` são incorporadas no build; altere os Build Args e faça novo deploy se precisar atualizar.
- O EasyPanel faz o TLS offload; o container expõe apenas HTTP.
- Se preferir separar frontend e webhook, crie 2 apps e aponte rotas distintas, mas o modelo acima foca em 1 app.

Passo a passo com seus valores (nowhats)
---------------------------------------
- Domínio do app: `https://chatnegocios.nowhats.com.br`.
- Webhook público: `https://chatnegocios.nowhats.com.br/api/evolution/webhook`.
- Manager Evolution: informar o webhook exatamente como acima.

- Build Args (Vite):
  - `VITE_EVOLUTION_API_URL`: `https://api.nowhats.com.br`.
  - `VITE_EVOLUTION_WEBHOOK_URL`: `https://chatnegocios.nowhats.com.br/api/evolution/webhook`.
  - `VITE_EVOLUTION_API_KEY`: `XZ3calYj8iGSF0KxuSQvAwkXFZVDMQjn`.
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0anhramx1dWZnZnFndW9laW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTMwMTIsImV4cCI6MjA3NDcyOTAxMn0.mlZuJLhMUQGeQC0CPIqrFSr1CFC2dA8Muhdpw08cidI`.
  - `VITE_SUPABASE_URL`: `https://rtjxkjluufgfqguoeinn.supabase.co`.

- Runtime (opcional, já default):
  - `PORT`: `3000`.
  - `WEBHOOK_PATH`: `/api/evolution/webhook`.

- Deploy:
  - Vincule `chatnegocios.nowhats.com.br` ao app no EasyPanel e ative SSL.
  - Build + Run com os valores acima.

- Testes rápidos:
  - SPA: `https://chatnegocios.nowhats.com.br/`.
  - Health: `https://chatnegocios.nowhats.com.br/health`.
  - Webhook: `https://chatnegocios.nowhats.com.br/api/evolution/webhook`.

- Atenção segurança:
  - Chaves em Build Args são incorporadas na imagem; considere definir no EasyPanel e evitar commit público.
## Deploy no EasyPanel após ajustes

- Rebuild sem cache e depois `Build & Run` para aplicar o novo `Dockerfile`.
- Confirme `Dockerfile Path` = `Dockerfile` e `Build Context` = `./`.
- Valide nos logs: `App ouvindo em http://0.0.0.0:3000` e `Webhook em .../api/evolution/webhook`.
- Se falhar, copie as últimas 20–30 linhas dos logs de build/exec e compartilhe.