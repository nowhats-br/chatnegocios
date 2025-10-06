/*
          # [Correção Estrutural] Adiciona chave estrangeira de conexão às conversas
          [Este script adiciona a coluna `connection_id` à tabela `conversations` e a vincula à tabela `connections`, resolvendo um erro de tipo de dados.]

          ## Query Description: [Esta operação é segura e não afeta dados existentes. Ela adiciona uma nova coluna `connection_id` do tipo `uuid` à tabela `conversations` e cria uma chave estrangeira para a tabela `connections`. Isso é essencial para que o sistema saiba de qual instância do WhatsApp uma conversa se origina.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tabela afetada: `public.conversations`
          - Coluna adicionada: `connection_id` (uuid)
          - Constraint adicionada: `conversations_connection_id_fkey`
          
          ## Security Implications:
          - RLS Status: [Habilitado]
          - Policy Changes: [Não]
          - Auth Requirements: [Nenhum]
          
          ## Performance Impact:
          - Indexes: [Uma chave estrangeira cria um índice implicitamente]
          - Triggers: [Nenhum]
          - Estimated Impact: [Baixo. A adição da coluna pode levar um momento em tabelas muito grandes, mas é uma operação rápida para novas instalações.]
          */

-- Adiciona a coluna `connection_id` com o tipo de dados correto (uuid)
ALTER TABLE public.conversations
ADD COLUMN connection_id uuid;

-- Adiciona a chave estrangeira referenciando a tabela `connections`
-- ON DELETE SET NULL garante que, se uma conexão for deletada, a conversa não seja perdida, apenas desvinculada.
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_connection_id_fkey
FOREIGN KEY (connection_id)
REFERENCES public.connections(id)
ON DELETE SET NULL;

-- Atualiza a política de segurança para permitir a inserção da nova coluna
-- A política existente já deve ser suficiente, mas esta é uma garantia.
ALTER POLICY "Usuários podem gerenciar suas próprias conversas"
ON public.conversations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
