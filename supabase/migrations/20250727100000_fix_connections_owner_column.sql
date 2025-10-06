/*
          # [Operation Name]
          Correção Definitiva da Tabela `connections`

          ## Query Description: [Este script corrige um erro crítico na tabela `connections`, renomeando a coluna `owner_id` para `user_id` e redefinindo as políticas de segurança (RLS) para garantir a consistência entre o banco de dados e a aplicação. A operação é segura e foi desenhada para funcionar independentemente do estado atual da tabela, prevenindo perda de dados.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Tabela afetada: `public.connections`
          - Ações: RENAME COLUMN, ALTER COLUMN, DROP POLICY, CREATE POLICY
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: A operação redefine as políticas para usar `auth.uid()` na coluna `user_id`.
          
          ## Performance Impact:
          - Indexes: Nenhum
          - Triggers: Nenhum
          - Estimated Impact: Baixo. A operação é rápida e afeta apenas a estrutura de metadados e as políticas.
          */
DO $$
BEGIN
    -- Step 1: Check if 'owner_id' column exists in 'connections' table.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'connections'
        AND column_name = 'owner_id'
    ) THEN
        -- 'owner_id' exists. Now check for 'user_id'.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'connections'
            AND column_name = 'user_id'
        ) THEN
            -- Both 'owner_id' and 'user_id' exist. This is a messy state.
            -- We will migrate data from 'owner_id' to 'user_id' where 'user_id' is null.
            UPDATE public.connections
            SET user_id = owner_id
            WHERE user_id IS NULL AND owner_id IS NOT NULL;

            -- Now, drop the incorrect 'owner_id' column.
            ALTER TABLE public.connections DROP COLUMN owner_id;
        ELSE
            -- Only 'owner_id' exists. This is the most likely scenario.
            -- Rename 'owner_id' to 'user_id'.
            ALTER TABLE public.connections RENAME COLUMN owner_id TO user_id;
        END IF;
    END IF;

    -- Step 2: Ensure 'user_id' column exists and has the correct constraints.
    -- This is a fallback in case neither column existed.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'connections'
        AND column_name = 'user_id'
    ) THEN
         ALTER TABLE public.connections
         ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Step 3: Make sure the user_id column is NOT NULL.
    ALTER TABLE public.connections ALTER COLUMN user_id SET NOT NULL;

    -- Step 4: Reset and correctly define the Row Level Security (RLS) policies.
    -- Drop existing policies to avoid conflicts.
    DROP POLICY IF EXISTS "Enable read access for own connections" ON public.connections;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.connections;
    DROP POLICY IF EXISTS "Enable update for own connections" ON public.connections;
    DROP POLICY IF EXISTS "Enable delete for own connections" ON public.connections;
    DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.connections;


    -- Ensure RLS is enabled.
    ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

    -- Create the correct policies using the 'user_id' column.
    CREATE POLICY "Enable read access for own connections"
    ON public.connections FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Enable insert for authenticated users"
    ON public.connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Enable update for own connections"
    ON public.connections FOR UPDATE
    USING (auth.uid() = user_id);

    CREATE POLICY "Enable delete for own connections"
    ON public.connections FOR DELETE
    USING (auth.uid() = user_id);

END $$;
