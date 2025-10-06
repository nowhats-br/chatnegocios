/*
          # [Operation Name]
          Adicionar campos de API da Evolution à tabela de perfis.

          ## Query Description: "Esta operação adiciona as colunas `evolution_api_url` e `evolution_api_key` à tabela `profiles`, permitindo que cada usuário armazene suas próprias credenciais de API de forma segura. Não há risco de perda de dados existentes."
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tabela afetada: `profiles`
          - Colunas adicionadas: `evolution_api_url` (text), `evolution_api_key` (text)
          
          ## Security Implications:
          - RLS Status: Mantido
          - Policy Changes: Não
          - Auth Requirements: As políticas existentes garantem que apenas o próprio usuário possa ler e escrever suas chaves.
          
          ## Performance Impact:
          - Indexes: Nenhum
          - Triggers: Nenhum
          - Estimated Impact: Nenhum impacto de performance esperado.
          */

-- Adiciona as colunas para armazenar as credenciais da API da Evolution por usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT;

-- Garante que as políticas de segurança existentes cubram as novas colunas
-- (Nenhuma alteração necessária se as políticas já usam `auth.uid() = id` para todas as colunas)
COMMENT ON COLUMN public.profiles.evolution_api_url IS 'URL base da API da Evolution para este usuário.';
COMMENT ON COLUMN public.profiles.evolution_api_key IS 'Chave de API da Evolution para este usuário.';
