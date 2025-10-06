/*
          # [Operação Estrutural] Adicionar Tabelas de Cadastros Avançados
          Cria as tabelas para gerenciamento de Tags, Filas, Equipes e expande a tabela de Contatos.

          ## Query Description: Esta migração adiciona novas tabelas e colunas para suportar funcionalidades de cadastro avançadas. Não há risco de perda de dados existentes, pois apenas adiciona novas estruturas.

          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true (com um script de remoção)
          
          ## Structure Details:
          - Cria a tabela `tags` para etiquetas de clientes.
          - Cria a tabela `contact_tags` para associar tags a contatos.
          - Adiciona a coluna `purchase_history` à tabela `contacts`.
          - Cria a tabela `queues` para filas de atendimento.
          - Cria a tabela `teams` para equipes de usuários.
          - Cria a tabela `team_members` para associar usuários a equipes.
          
          ## Security Implications:
          - RLS Status: Habilitado para todas as novas tabelas.
          - Policy Changes: Novas políticas de segurança são criadas para garantir que os usuários só possam acessar seus próprios dados.
          - Auth Requirements: As políticas dependem do `auth.uid()` do usuário logado.
          
          ## Performance Impact:
          - Indexes: Chaves primárias e estrangeiras são indexadas por padrão.
          - Triggers: Nenhum.
          - Estimated Impact: Baixo.
          */

-- 1. Tabela para Tags
CREATE TABLE public.tags (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own tags" ON public.tags
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Tabela de ligação entre Contatos e Tags
CREATE TABLE public.contact_tags (
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tags for their own contacts" ON public.contact_tags
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.contacts WHERE id = contact_id AND user_id = auth.uid()));

-- 3. Adicionar histórico de compras aos Contatos
ALTER TABLE public.contacts
ADD COLUMN purchase_history jsonb;

-- 4. Tabela para Filas de Atendimento
CREATE TABLE public.queues (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own queues" ON public.queues
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Tabela para Equipes
CREATE TABLE public.teams (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Team owner
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team owners can manage their own teams" ON public.teams
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Tabela de ligação para membros da equipe
CREATE TABLE public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member'::text, -- ex: 'admin', 'member'
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view their own team" ON public.team_members
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_members.team_id AND user_id = auth.uid()));
CREATE POLICY "Team owners can manage team members" ON public.team_members
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND user_id = auth.uid()));
