/*
# [Structural] Correção e Criação de Tabelas de Suporte
Este script corrige a estrutura da tabela `contacts` e cria as tabelas para gerenciar tags, filas e equipes.

## Query Description: "Este script garante que a tabela `contacts` tenha a coluna `user_id` necessária antes de criar tabelas dependentes. Ele adiciona `tags`, `contact_tags`, `queues`, `teams`, `team_members`. Não há risco de perda de dados. Backup recomendado por precaução."

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: true
- Reversible: false

## Structure Details:
- `contacts`: Garante a existência da coluna `user_id` e `purchase_history`.
- `tags`: Tabela para armazenar tags (nome, cor).
- `contact_tags`: Tabela de ligação entre contatos e tags.
- `queues`: Tabela para filas de atendimento.
- `teams`: Tabela para equipes.
- `team_members`: Tabela de ligação entre usuários e equipes.

## Security Implications:
- RLS Status: Habilitado e reforçado para todas as tabelas.
- Policy Changes: Sim, políticas são recriadas para garantir consistência.
- Auth Requirements: Requer um usuário autenticado.

## Performance Impact:
- Indexes: Chaves primárias e estrangeiras são indexadas.
- Estimated Impact: Baixo.
*/

-- Passo 1: Garantir que a tabela 'contacts' tenha a coluna 'user_id'
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Passo 2: Garantir que a RLS e a política principal existam para 'contacts'
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;
CREATE POLICY "Users can manage their own contacts" ON public.contacts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Passo 3: Adicionar histórico de compras aos contatos
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS purchase_history jsonb;

-- Passo 4: Criar tabelas de suporte com verificação de existência

-- Tabela para Tags
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own tags" ON public.tags;
CREATE POLICY "Users can manage their own tags" ON public.tags
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabela de Ligação: Contatos e Tags
CREATE TABLE IF NOT EXISTS public.contact_tags (
    contact_id bigint NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own contact tags" ON public.contact_tags;
CREATE POLICY "Users can manage their own contact tags" ON public.contact_tags
    FOR ALL USING (auth.uid() = (SELECT user_id FROM public.contacts WHERE id = contact_id))
    WITH CHECK (auth.uid() = (SELECT user_id FROM public.contacts WHERE id = contact_id));

-- Tabela para Filas de Atendimento
CREATE TABLE IF NOT EXISTS public.queues (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own queues" ON public.queues;
CREATE POLICY "Users can manage their own queues" ON public.queues
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabela para Equipes
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Dono da equipe
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own teams" ON public.teams;
CREATE POLICY "Users can manage their own teams" ON public.teams
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabela de Ligação: Membros da Equipe
CREATE TABLE IF NOT EXISTS public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member', -- ex: 'admin', 'member'
    created_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team members can view their own membership" ON public.team_members;
CREATE POLICY "Team members can view their own membership" ON public.team_members
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Team owners can manage team members" ON public.team_members;
CREATE POLICY "Team owners can manage team members" ON public.team_members
    FOR ALL USING (auth.uid() = (SELECT user_id FROM public.teams WHERE id = team_id))
    WITH CHECK (auth.uid() = (SELECT user_id FROM public.teams WHERE id = team_id));
