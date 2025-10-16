Chat Negócios — Configuração de Evolution API

Webhooks
---------
- O webhook da Evolution API deve apontar para um endpoint PÚBLICO seu, capaz de receber requisições HTTP (POST) e processar eventos (ex.: mensagens, atualização de conexão, QR code atualizado).
- Não use a URL do provedor da Evolution como webhook. Essa URL é a origem dos eventos, não o destino. O destino deve ser um serviço seu.
- Configure `VITE_EVOLUTION_WEBHOOK_URL` com a sua URL pública (ex.: `https://seu-dominio.com/api/evolution/webhook`). Em desenvolvimento, use um túnel (ngrok, Cloudflared) e aponte para esse endereço público.
- Se `VITE_EVOLUTION_WEBHOOK_URL` não estiver definida, a criação de instância enviará o webhook como desabilitado para evitar apontar incorretamente para `localhost`.

Diferença: URL base da API vs Webhook (destino)
-----------------------------------------------
- `VITE_EVOLUTION_API_URL` é a URL base do seu provedor Evolution (ex.: `https://evo.nowhats.com.br`). É onde o app faz requisições para criar/gerar QR/etc.
- `VITE_EVOLUTION_WEBHOOK_URL` é a SUA URL pública que recebe os eventos via POST.
- Exemplo incorreto de webhook (não usar): `https://evo.nowhats.com.br/api/evolution/webhook`.
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
- `VITE_EVOLUTION_API_URL`: URL base da Evolution API do seu provedor (ex.: `https://evo.nowhats.com.br`).
- `VITE_EVOLUTION_API_KEY`: Chave da API fornecida pelo seu provedor.
- `VITE_EVOLUTION_QR_ENDPOINT_TEMPLATE`: Template opcional para a rota do QR.
- `VITE_EVOLUTION_WEBHOOK_URL`: URL pública do seu endpoint receptor de webhooks.

Observações
-----------
- Reinicie o processo de desenvolvimento (`npm run dev`) após alterar o `.env`.
- Em produção, hospede o endpoint de webhook em um backend ou função serverless (Supabase Edge Functions, Cloudflare Workers, Express em Railway/Render, etc.).