/*
          # [Fortalecimento do Schema e Criação de ENUMs]
          Este script introduz tipos de dados ENUM para garantir a integridade dos dados e atualiza as tabelas para usá-los. Também melhora a segurança da função de criação de perfil de usuário.

          ## Query Description: [Esta operação irá alterar a estrutura de tabelas existentes para usar tipos de dados mais estritos (ENUMs). Nenhum dado será perdido, pois os valores existentes são compatíveis. A função de criação de usuário será substituída por uma versão mais segura. É uma operação segura e recomendada para a estabilidade do sistema.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tipos Criados: connection_status_enum, conversation_status_enum, message_type_enum
          - Tabelas Afetadas: connections, conversations, messages (tipos de coluna alterados)
          - Funções Afetadas: handle_new_user (recriada com SECURITY DEFINER)
          
          ## Security Implications:
          - RLS Status: Inalterado
          - Policy Changes: Não
          - Auth Requirements: Nenhum
          
          ## Performance Impact:
          - Indexes: Nenhum
          - Triggers: O trigger 'on_auth_user_created' será recriado.
          - Estimated Impact: Baixo. A alteração de tipo pode causar um breve bloqueio nas tabelas durante a migração.
          */

-- Cria os tipos ENUM para garantir a consistência dos dados
CREATE TYPE public.connection_status_enum AS ENUM ('CONNECTED', 'DISCONNECTED', 'WAITING_QR_CODE', 'INITIALIZING', 'PAUSED');
CREATE TYPE public.conversation_status_enum AS ENUM ('new', 'active', 'pending', 'resolved');
CREATE TYPE public.message_type_enum AS ENUM ('text', 'image', 'audio', 'video', 'file', 'product');

-- Altera a coluna 'status' na tabela 'connections'
ALTER TABLE public.connections
ALTER COLUMN status TYPE public.connection_status_enum
USING status::text::connection_status_enum;

-- Altera a coluna 'status' na tabela 'conversations'
ALTER TABLE public.conversations
ALTER COLUMN status TYPE public.conversation_status_enum
USING status::text::conversation_status_enum;

-- Altera a coluna 'message_type' na tabela 'messages'
ALTER TABLE public.messages
ALTER COLUMN message_type TYPE public.message_type_enum
USING message_type::text::message_type_enum;

-- Recria a função handle_new_user com as melhores práticas de segurança
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Recria o trigger para usar a nova função
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
