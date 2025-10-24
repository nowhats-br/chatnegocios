/*
# [SECURITY] Harden Database Functions
Ajusta as funções `handle_new_user` e `ensure_profile_exists` para definir um `search_path` explícito.

## Query Description: [Esta operação corrige um aviso de segurança comum do Supabase ("Function Search Path Mutable"). Ao fixar o caminho de busca, evitamos que um usuário mal-intencionado possa, teoricamente, manipular o caminho para executar código inesperado. É uma alteração segura e recomendada que não afeta dados existentes.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Functions affected:
  - `public.handle_new_user()`
  - `public.ensure_profile_exists()`

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: Admin privileges to alter functions.
- Fixes Security Advisory: "Function Search Path Mutable"

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible.
*/

-- Harden handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Harden ensure_profile_exists function
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid := auth.uid();
    user_email text := auth.jwt()->>'email';
BEGIN
    IF user_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, email)
        VALUES (user_id, user_email)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END;
$$;
