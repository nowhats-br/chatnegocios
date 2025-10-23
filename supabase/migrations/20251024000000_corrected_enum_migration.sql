/*
          # [Estrutura] Migração Corrigida para Tipos de Dados (ENUMs)
          [Este script corrige a migração anterior que falhou. Ele cria tipos de dados restritos (ENUMs) para status de conexão, status de conversa e tipos de mensagem, e atualiza as tabelas existentes para usar esses novos tipos de forma segura.]

          ## Query Description: [Esta operação irá alterar a estrutura das tabelas `connections`, `conversations` e `messages`. Ela garante que apenas valores de status e tipo de mensagem válidos sejam armazenados, aumentando a integridade dos dados e prevenindo erros na aplicação. A operação é segura e preserva todos os dados existentes, convertendo-os para o novo formato.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Cria ENUMs: `connection_status_enum`, `conversation_status_enum`, `message_type_enum`.
          - Altera colunas: `connections.status`, `conversations.status`, `messages.message_type`.
          
          ## Security Implications:
          - RLS Status: [Não alterado]
          - Policy Changes: [Não]
          - Auth Requirements: [Nenhum]
          
          ## Performance Impact:
          - Indexes: [Não alterado]
          - Triggers: [Não alterado]
          - Estimated Impact: [Baixo. A operação pode causar um bloqueio breve nas tabelas durante a alteração.]
          */

-- 1. Enum para Status de Conexão
CREATE TYPE public.connection_status_enum AS ENUM ('CONNECTED', 'DISCONNECTED', 'WAITING_QR_CODE', 'INITIALIZING', 'PAUSED');

-- Altera a tabela connections de forma segura
ALTER TABLE public.connections
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.connections
  ALTER COLUMN status TYPE public.connection_status_enum USING status::text::connection_status_enum;

ALTER TABLE public.connections
  ALTER COLUMN status SET DEFAULT 'DISCONNECTED'::public.connection_status_enum;


-- 2. Enum para Status de Conversa
CREATE TYPE public.conversation_status_enum AS ENUM ('new', 'active', 'pending', 'resolved');

-- Altera a tabela conversations de forma segura
ALTER TABLE public.conversations
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.conversations
  ALTER COLUMN status TYPE public.conversation_status_enum USING status::text::conversation_status_enum;

ALTER TABLE public.conversations
  ALTER COLUMN status SET DEFAULT 'new'::public.conversation_status_enum;


-- 3. Enum para Tipo de Mensagem
CREATE TYPE public.message_type_enum AS ENUM ('text', 'image', 'audio', 'video', 'file', 'product');

-- Altera a tabela messages de forma segura
ALTER TABLE public.messages
  ALTER COLUMN message_type DROP DEFAULT;

ALTER TABLE public.messages
  ALTER COLUMN message_type TYPE public.message_type_enum USING message_type::text::message_type_enum;

ALTER TABLE public.messages
  ALTER COLUMN message_type SET DEFAULT 'text'::public.message_type_enum;
