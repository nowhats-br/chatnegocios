/*
# [Estrutura para Cadastros Avançados]
Este script cria as tabelas essenciais para gerenciar Clientes (com tags), Filas de Atendimento, e Equipes de Usuários.

## Descrição da Query:
- **Criação de Tabelas:** Adiciona `tags`, `contact_tags`, `queues`, `teams`, e `team_members`.
- **Modificação de Tabela:** Altera a tabela `contacts` para adicionar um campo de histórico de compras.
- **Segurança:** Habilita Row Level Security (RLS) em todas as novas tabelas e define políticas para garantir que os usuários só possam acessar seus próprios dados.

## Metadados:
- Categoria do Esquema: "Estrutural"
- Nível de Impacto: "Médio"
- Requer Backup: false (Apenas adiciona novas estruturas)
- Reversível: true (Pode ser revertido com comandos DROP)

## Detalhes da Estrutura:
- **Tabelas Criadas:** public.tags, public.contact_tags, public.queues, public.teams, public.team_members.
- **Tabelas Alteradas:** public.contacts.

## Implicações de Segurança:
- Status RLS: Habilitado para todas as novas tabelas.
- Mudanças de Política: Adiciona políticas de `select`, `insert`, `update`, `delete` baseadas no `user_id` autenticado.
- Requisitos de Autenticação: O usuário precisa estar autenticado para interagir com estas tabelas.

## Impacto no Desempenho:
- Índices: Adiciona chaves primárias e índices de chave estrangeira, o que é bom para o desempenho das consultas.
- Triggers: Nenhum.
- Impacto Estimado: Baixo.
*/

-- Tabela para Tags (Etiquetas)
create table if not exists public.tags (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    color text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Habilita RLS
alter table public.tags enable row level security;
-- Políticas de RLS
create policy "Usuários podem ver suas próprias tags" on public.tags for select using (auth.uid() = user_id);
create policy "Usuários podem inserir suas próprias tags" on public.tags for insert with check (auth.uid() = user_id);
create policy "Usuários podem atualizar suas próprias tags" on public.tags for update using (auth.uid() = user_id);
create policy "Usuários podem deletar suas próprias tags" on public.tags for delete using (auth.uid() = user_id);


-- Tabela de Ligação entre Contatos e Tags
create table if not exists public.contact_tags (
    contact_id bigint not null references public.contacts(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    primary key (contact_id, tag_id)
);
-- Habilita RLS
alter table public.contact_tags enable row level security;
-- Políticas de RLS (um pouco mais complexo, pois envolve verificar a propriedade de ambos, contato e tag)
create policy "Usuários podem gerenciar tags de seus próprios contatos" on public.contact_tags
    for all using (
        auth.uid() = (select user_id from public.contacts where id = contact_id) and
        auth.uid() = (select user_id from public.tags where id = tag_id)
    );


-- Altera a tabela de contatos para adicionar histórico de compras
alter table public.contacts add column if not exists purchase_history jsonb;


-- Tabela para Filas de Atendimento
create table if not exists public.queues (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Habilita RLS
alter table public.queues enable row level security;
-- Políticas de RLS
create policy "Usuários podem ver suas próprias filas" on public.queues for select using (auth.uid() = user_id);
create policy "Usuários podem inserir suas próprias filas" on public.queues for insert with check (auth.uid() = user_id);
create policy "Usuários podem atualizar suas próprias filas" on public.queues for update using (auth.uid() = user_id);
create policy "Usuários podem deletar suas próprias filas" on public.queues for delete using (auth.uid() = user_id);


-- Tabela para Equipes
create table if not exists public.teams (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null, -- Dono da equipe
    name text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Habilita RLS
alter table public.teams enable row level security;
-- Políticas de RLS
create policy "Membros da equipe podem ver a equipe" on public.teams for select using (
    auth.uid() = user_id or -- Dono pode ver
    exists (select 1 from public.team_members where team_id = id and user_id = auth.uid()) -- Membros podem ver
);
create policy "Dono pode inserir equipes" on public.teams for insert with check (auth.uid() = user_id);
create policy "Dono pode atualizar equipes" on public.teams for update using (auth.uid() = user_id);
create policy "Dono pode deletar equipes" on public.teams for delete using (auth.uid() = user_id);


-- Tabela de Ligação entre Usuários e Equipes (Membros da Equipe)
create table if not exists public.team_members (
    team_id uuid not null references public.teams(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text default 'member' not null, -- Ex: 'admin', 'member'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (team_id, user_id)
);
-- Habilita RLS
alter table public.team_members enable row level security;
-- Políticas de RLS
create policy "Membros podem ver outros membros da mesma equipe" on public.team_members for select using (
    exists (select 1 from public.team_members where team_id = public.team_members.team_id and user_id = auth.uid())
);
create policy "Dono da equipe pode adicionar/remover membros" on public.team_members for all using (
    auth.uid() = (select user_id from public.teams where id = team_id)
);
