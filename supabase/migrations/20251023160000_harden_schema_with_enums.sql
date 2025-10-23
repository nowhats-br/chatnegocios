/*
          # [Operation Name]
          Criar Tipos de Status (ENUMs)

          ## Query Description: Este script cria três novos tipos de dados (ENUMs) para padronizar e restringir os valores possíveis em colunas de status e tipo em várias tabelas. Isso aumenta a integridade dos dados, previne a inserção de valores inválidos e torna o esquema do banco de dados mais robusto e auto-documentado. Não há risco de perda de dados nesta operação, pois ela apenas define novos tipos.
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Cria o ENUM `public.connection_status`.
          - Cria o ENUM `public.conversation_status`.
          - Cria o ENUM `public.message_type`.
          
          ## Security Implications:
          - RLS Status: [Disabled]
          - Policy Changes: [No]
          - Auth Requirements: [N/A]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [Nenhum impacto de performance esperado.]
          */
CREATE TYPE public.connection_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'WAITING_QR_CODE', 'INITIALIZING', 'PAUSED');
CREATE TYPE public.conversation_status AS ENUM ('new', 'active', 'pending', 'resolved');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'audio', 'video', 'file', 'product');

/*
          # [Operation Name]
          Alterar Colunas para Usar Tipos ENUM

          ## Query Description: Este script altera as tabelas `connections`, `conversations` e `messages` para usar os novos tipos ENUM criados. Ele converte (cast) os dados de texto existentes para os novos tipos. Esta é uma alteração estrutural segura que garante que apenas valores válidos sejam usados no futuro. Também define um valor padrão ('pending') para o status de novas conversas, simplificando a lógica do webhook.
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Medium"]
          - Requires-Backup: [true]
          - Reversible: [false]
          
          ## Structure Details:
          - Altera `connections.status` para usar o tipo `connection_status`.
          - Altera `conversations.status` para usar o tipo `conversation_status` e define o padrão como 'pending'.
          - Altera `messages.message_type` para usar o tipo `message_type`.
          
          ## Security Implications:
          - RLS Status: [Enabled/Disabled]
          - Policy Changes: [No]
          - Auth Requirements: [N/A]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [Pode haver um pequeno impacto de performance durante a alteração da tabela, dependendo do volume de dados. Após a alteração, o desempenho pode melhorar ligeiramente devido ao uso de ENUMs.]
          */
ALTER TABLE public.connections ALTER COLUMN status TYPE public.connection_status USING status::text::connection_status;
ALTER TABLE public.conversations ALTER COLUMN status TYPE public.conversation_status USING status::text::conversation_status;
ALTER TABLE public.conversations ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.messages ALTER COLUMN message_type TYPE public.message_type USING message_type::text::message_type;
