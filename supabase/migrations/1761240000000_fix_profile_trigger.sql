/*
  # [Function] handle_new_user
  [This function creates a new user profile upon registration.]

  ## Query Description: [Updates the handle_new_user function to set a fixed search_path. This is a security enhancement to prevent potential search path hijacking attacks and addresses a security advisory. It does not change the core logic of the function, but ensures it runs in a secure and predictable context, which should resolve the RLS violation on profile creation.]
  
  ## Metadata:
  - Schema-Category: ["Structural"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true]
  
  ## Structure Details:
  - Function: public.handle_new_user
  
  ## Security Implications:
  - RLS Status: [No Change]
  - Policy Changes: [No]
  - Auth Requirements: [None]
  
  ## Performance Impact:
  - Indexes: [None]
  - Triggers: [None]
  - Estimated Impact: [Negligible performance impact. Improves security and reliability of the trigger.]
*/
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
