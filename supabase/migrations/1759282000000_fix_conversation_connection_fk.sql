/*
# [Fix] Corrige a Chave Estrangeira entre Conversas e Conexões
[Este script corrige um erro de tipo de dados ao adicionar a coluna `connection_id` na tabela `conversations`. A coluna será criada como `bigint` para ser compatível com a chave primária da tabela `connections`.]

## Query Description: [Esta operação adiciona uma nova coluna (`connection_id`) à tabela `conversations` e cria uma chave estrangeira para a tabela `connections`. A operação é segura e não afeta dados existentes, pois a coluna será inicialmente nula.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- Tabela Afetada: `public.conversations`
- Coluna Adicionada: `connection_id` (tipo: `bigint`)
- Chave Estrangeira: `conversations.connection_id` -> `connections.id`

## Security Implications:
- RLS Status: [N/A]
- Policy Changes: [No]
- Auth Requirements: [N/A]

## Performance Impact:
- Indexes: [Uma chave estrangeira geralmente cria um índice automaticamente, o que pode melhorar o desempenho de joins.]
- Triggers: [N/A]
- Estimated Impact: [Baixo]
*/

-- Adiciona a coluna connection_id na tabela conversations com o tipo correto (bigint)
alter table public.conversations
add column connection_id bigint;

-- Adiciona a restrição de chave estrangeira
alter table public.conversations
add constraint conversations_connection_id_fkey
foreign key (connection_id)
references public.connections(id)
on delete set null;
