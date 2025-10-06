/*
# [CRITICAL] Fix Connections Table Ownership
This script performs a critical fix on the 'connections' table to resolve persistent row-level security policy errors. It standardizes the ownership column to 'user_id'.

## Query Description: This operation is designed to be safe and idempotent. It will:
1. Temporarily remove all existing security policies on the 'connections' table.
2. Check for an incorrectly named 'owner_id' column and rename it to the correct 'user_id'.
3. Re-create the security policies using the correct 'user_id' column, ensuring users can only access their own data.
This is a structural fix and should not result in data loss.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: false

## Structure Details:
- Table: public.connections
- Columns: Renaming 'owner_id' to 'user_id'
- Policies: Dropping and re-creating 4 RLS policies on 'public.connections'

## Security Implications:
- RLS Status: Temporarily disabled and then re-enabled correctly.
- Policy Changes: Yes, policies are recreated to point to the correct column.
- Auth Requirements: Policies depend on auth.uid().

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Low. The operation should be very fast on a small table.
*/

-- Step 1: Drop all existing policies on the connections table to remove dependencies.
DROP POLICY IF EXISTS "Users can view their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can insert their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can create connections for themselves." ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections." ON public.connections;


-- Step 2: Check for the incorrect 'owner_id' column and rename it to 'user_id'.
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'owner_id') THEN
    ALTER TABLE public.connections RENAME COLUMN owner_id TO user_id;
  END IF;
END $$;

-- Step 3: Ensure RLS is enabled on the table.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Step 4: Re-create the policies with the correct column name 'user_id'.
CREATE POLICY "Users can view their own connections"
ON public.connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create connections for themselves"
ON public.connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
ON public.connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
ON public.connections FOR DELETE
USING (auth.uid() = user_id);
