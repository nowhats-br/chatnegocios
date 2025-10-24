-- Habilita a extensão pgcrypto se ainda não estiver habilitada, necessária para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- =================================================================
-- 1. CRIAÇÃO DE TIPOS ENUM (IDEMPOTENTE)
-- =================================================================
-- Cria o tipo 'connection_status' somente se ele não existir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
        CREATE TYPE public.connection_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'WAITING_QR_CODE', 'INITIALIZING', 'PAUSED');
    END IF;
END
$$;

-- Cria o tipo 'conversation_status' somente se ele não existir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
        CREATE TYPE public.conversation_status AS ENUM ('new', 'active', 'pending', 'resolved');
    END IF;
END
$$;

-- Cria o tipo 'message_type' somente se ele não existir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
        CREATE TYPE public.message_type AS ENUM ('text', 'image', 'audio', 'video', 'file', 'product');
    END IF;
END
$$;

-- =================================================================
-- 2. CRIAÇÃO DAS TABELAS (IDEMPOTENTE)
-- =================================================================

-- Tabela de perfis de usuário, estendendo auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email character varying,
    evolution_api_url text,
    evolution_api_key text
);
COMMENT ON TABLE public.profiles IS 'Armazena informações de perfil e configurações para cada usuário.';

-- Tabela de conexões com a API Evolution
CREATE TABLE IF NOT EXISTS public.connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_name character varying NOT NULL,
    status public.connection_status NOT NULL DEFAULT 'DISCONNECTED',
    instance_data jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.connections IS 'Armazena as instâncias de conexão do WhatsApp para cada usuário.';

-- Tabela de contatos
CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number character varying NOT NULL,
    name character varying,
    avatar_url text,
    purchase_history jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, phone_number)
);
COMMENT ON TABLE public.contacts IS 'Armazena os contatos (clientes) de cada usuário.';

-- Tabela de etiquetas (tags)
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    color character varying(7),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tags IS 'Etiquetas para categorizar contatos.';

-- Tabela de junção para contatos e etiquetas (Muitos-para-Muitos)
CREATE TABLE IF NOT EXISTS public.contact_tags (
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
COMMENT ON TABLE public.contact_tags IS 'Associa etiquetas aos contatos.';

-- Tabela de filas de atendimento
CREATE TABLE IF NOT EXISTS public.queues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.queues IS 'Filas para organizar os atendimentos.';

-- Tabela de equipes
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.teams IS 'Equipes de usuários para gerenciamento de acesso.';

-- Tabela de junção para membros da equipe (Muitos-para-Muitos)
CREATE TABLE IF NOT EXISTS public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role character varying NOT NULL DEFAULT 'member',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
COMMENT ON TABLE public.team_members IS 'Associa usuários a equipes com papéis específicos.';

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    stock integer,
    image_url text,
    category character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.products IS 'Catálogo de produtos por usuário.';

-- Tabela de respostas rápidas
CREATE TABLE IF NOT EXISTS public.quick_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shortcut character varying NOT NULL UNIQUE,
    message text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.quick_responses IS 'Atalhos para mensagens usadas frequentemente.';

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
    status public.conversation_status DEFAULT 'new',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.conversations IS 'Registra uma conversa com um contato.';

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.messages (
    id text PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_is_user boolean NOT NULL,
    content text,
    message_type public.message_type NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.messages IS 'Armazena cada mensagem dentro de uma conversa.';

-- =================================================================
-- 3. FUNÇÕES E TRIGGERS (IDEMPOTENTE)
-- =================================================================

-- Função para criar um perfil para um novo usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user() IS 'Cria automaticamente um perfil na tabela `profiles` quando um novo usuário é inserido em `auth.users`.';

-- Trigger que chama a função handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para garantir que o perfil de um usuário logado exista
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    profile_exists boolean;
BEGIN
    -- Define o search_path para garantir que a função encontre as tabelas corretas
    SET search_path = public;

    -- Verifica se o perfil já existe
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = current_user_id) INTO profile_exists;

    -- Se não existir, insere o novo perfil
    IF NOT profile_exists THEN
        INSERT INTO profiles (id, email)
        SELECT u.id, u.email FROM auth.users u WHERE u.id = current_user_id;
    END IF;
END;
$$;
COMMENT ON FUNCTION public.ensure_profile_exists() IS 'Verifica e cria um perfil para o usuário logado, caso não exista. Útil para usuários existentes antes da implementação do trigger.';

-- =================================================================
-- 4. POLÍTICAS DE SEGURANÇA (RLS)
-- =================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes antes de criar novas para garantir idempotência
DROP POLICY IF EXISTS "Usuários podem acessar seus próprios perfis." ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias conexões." ON public.connections;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios contatos." ON public.contacts;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias etiquetas." ON public.tags;
DROP POLICY IF EXISTS "Usuários podem gerenciar as associações de suas etiquetas." ON public.contact_tags;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias filas." ON public.queues;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias equipes." ON public.teams;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios membros de equipe." ON public.team_members;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios produtos." ON public.products;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias respostas rápidas." ON public.quick_responses;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias conversas." ON public.conversations;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias mensagens." ON public.messages;

-- Cria as políticas de RLS
CREATE POLICY "Usuários podem acessar seus próprios perfis." ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuários podem gerenciar suas próprias conexões." ON public.connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar seus próprios contatos." ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias etiquetas." ON public.tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar as associações de suas etiquetas." ON public.contact_tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias filas." ON public.queues FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias equipes." ON public.teams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar seus próprios membros de equipe." ON public.team_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar seus próprios produtos." ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias respostas rápidas." ON public.quick_responses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias conversas." ON public.conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem gerenciar suas próprias mensagens." ON public.messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
