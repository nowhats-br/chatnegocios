/*
          # [Operation Name]
          Correção Definitiva do Tipo da Coluna 'status'

          ## Query Description: ["Este script corrige um erro de migração persistente na tabela 'conversations'. Ele garante que a coluna 'status' seja convertida para o tipo ENUM 'ConversationStatus' de forma segura, executando as operações na ordem correta para evitar erros de cast. Nenhuma perda de dados é esperada."]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Tabela afetada: public.conversations
          - Coluna afetada: status
          - Tipo criado: public."ConversationStatus"
          
          ## Security Implications:
          - RLS Status: [Enabled/Disabled]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
          - Estimated Impact: [Baixo. A operação pode bloquear a tabela 'conversations' brevemente durante a alteração do tipo da coluna.]
          */
DO $$
BEGIN
    -- Step 1: Create the ENUM type if it doesn't already exist.
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversationstatus') THEN
        CREATE TYPE public."ConversationStatus" AS ENUM ('new', 'active', 'pending', 'resolved');
    END IF;
END$$;

-- Step 2: Drop the old default value from the status column.
-- This is the crucial step to prevent the casting error.
ALTER TABLE public.conversations ALTER COLUMN status DROP DEFAULT;

-- Step 3: Alter the column type, casting existing values.
ALTER TABLE public.conversations
ALTER COLUMN status TYPE public."ConversationStatus"
USING status::text::public."ConversationStatus";

-- Step 4: Set the new default value.
ALTER TABLE public.conversations
ALTER COLUMN status SET DEFAULT 'new';
