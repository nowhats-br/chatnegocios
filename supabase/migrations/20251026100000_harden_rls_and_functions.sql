/*
# [Hardening] RLS Policies, Functions, and Security Fixes
This migration script introduces several improvements to enhance database security and robustness.

## Query Description: This script will:
1.  Modify the `handle_new_user` function to explicitly set the `search_path`, addressing a security advisory.
2.  Create a new `ensure_profile_exists` function. This allows the application to create a profile for users who signed up before the original trigger was in place, fixing potential errors on the settings page.
3.  Re-create and harden the Row Level Security (RLS) policies for the `profiles` table to ensure users can only access and modify their own data.
This operation is safe and should not impact existing data. No backup is strictly required, but it's always good practice.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Functions modified: `handle_new_user`
- Functions created: `ensure_profile_exists`
- RLS Policies modified: `profiles` table policies for SELECT, INSERT, UPDATE.

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes. Policies for `profiles` are refined for better security.
- Auth Requirements: Operations require authenticated users.

## Performance Impact:
- Indexes: None
- Triggers: `on_auth_user_created` trigger is modified via its function.
- Estimated Impact: Negligible performance impact.
*/

-- Step 1: Harden the new user trigger function to fix search_path warning.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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

-- Re-apply the trigger to use the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Step 2: Create a function to retroactively create profiles for existing users.
-- This function can be called from the client-side via RPC.
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid := auth.uid();
    profile_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = user_id) INTO profile_exists;
    
    IF NOT profile_exists THEN
        INSERT INTO public.profiles (id, email)
        VALUES (user_id, (SELECT email FROM auth.users WHERE id = user_id));
    END IF;
END;
$$;

-- Grant execute permission to the 'authenticated' role
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists() TO authenticated;


-- Step 3: Re-create and harden RLS policies for the 'profiles' table.
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

-- Create new, robust policies
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
