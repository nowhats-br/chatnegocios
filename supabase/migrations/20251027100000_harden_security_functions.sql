/*
# [Hardening] Set Secure Search Path for Functions
This operation hardens database functions by explicitly setting their `search_path`. This is a security best practice that prevents potential hijacking attacks by ensuring functions only look for objects within the specified schemas. This addresses the "Function Search Path Mutable" security advisory.

## Query Description: [This operation modifies two existing database functions (`handle_new_user` and `ensure_profile_exists`) to improve security. It redefines them to include `SET search_path`. This change has no impact on existing data and is safe to apply.]

## Metadata:
- Schema-Category: ["Security", "Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Function `public.handle_new_user` will be altered.
- Function `public.ensure_profile_exists` will be altered.

## Security Implications:
- RLS Status: [No Change]
- Policy Changes: [No]
- Auth Requirements: [Admin privileges to alter functions]
- Mitigates: Search Path Hijacking.

## Performance Impact:
- Indexes: [No Change]
- Triggers: [No Change]
- Estimated Impact: [Negligible.]
*/

-- Harden the trigger function for new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

-- Harden the RPC function for ensuring profile exists for current user
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
