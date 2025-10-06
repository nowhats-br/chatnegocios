/*
  # [Refatoração da Tabela de Conexões]
  Adiciona uma coluna para armazenar dados da instância e ajusta políticas de segurança.

  ## Query Description: [Esta operação adiciona a coluna `instance_data` à tabela `connections` para armazenar informações extras retornadas pela API (via n8n), como status detalhado, número de telefone conectado, etc. Isso torna o sistema mais robusto e preparado para futuras funcionalidades sem a necessidade de novas migrações. As políticas de segurança são atualizadas para incluir esta nova coluna.]

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Tabela afetada: `public.connections`
  - Coluna adicionada: `instance_data` (jsonb, nullable)

  ## Security Implications:
  - RLS Status: Enabled
  - Policy Changes: Yes (políticas de INSERT e UPDATE são atualizadas para permitir a modificação da nova coluna)

  ## Performance Impact:
  - Indexes: None
  - Triggers: None
  - Estimated Impact: Nenhum impacto significativo de performance esperado.
*/

-- Adiciona a nova coluna para dados da instância
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS instance_data jsonb;

-- Recria as políticas para garantir que a nova coluna seja coberta
-- Primeiro, remove as políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Users can view their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can create connections for themselves." ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections." ON public.connections;

-- Recria as políticas de segurança com a coluna correta
CREATE POLICY "Users can view their own connections."
ON public.connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create connections for themselves."
ON public.connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections."
ON public.connections FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections."
ON public.connections FOR DELETE
USING (auth.uid() = user_id);
