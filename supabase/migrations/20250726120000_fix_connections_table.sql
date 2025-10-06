/*
          # [Fix Connections Table Schema]
          This migration adds the missing 'user_id' column to the 'connections' table and sets up the correct Row Level Security (RLS) policies. This is a critical fix to resolve "violates row-level security policy" errors by ensuring each connection is owned by a user.

          ## Query Description: [This operation modifies the 'connections' table to add a user ownership column and enforces security policies. No data will be lost, but existing connections without a user will be inaccessible until manually updated. This is a necessary step for data security.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Medium"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Table 'connections': Adds 'user_id' column.
          - Table 'connections': Enables RLS.
          - Table 'connections': Creates SELECT, INSERT, UPDATE, DELETE policies based on 'user_id'.
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: All actions on 'connections' will require an authenticated user.
          
          ## Performance Impact:
          - Indexes: A foreign key index will be added on 'user_id'.
          - Triggers: None
          - Estimated Impact: Low.
          */

-- Step 1: Add the user_id column to the connections table if it doesn't exist.
-- This column is essential for linking connections to a specific user.
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Enable Row Level Security on the table.
-- This is the master switch to make policies active.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any old, potentially incorrect policies to ensure a clean state.
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.connections;
DROP POLICY IF EXISTS "Allow individual access" ON public.connections;
DROP POLICY IF EXISTS "Allow read access to everyone" ON public.connections;
DROP POLICY IF EXISTS "Allow individual read access" ON public.connections;
DROP POLICY IF EXISTS "Allow individual insert access" ON public.connections;
DROP POLICY IF EXISTS "Allow individual update access" ON public.connections;
DROP POLICY IF EXISTS "Allow individual delete access" ON public.connections;


-- Step 4: Create policies that ensure users can only manage their own connections.

-- Users can view their own connections.
CREATE POLICY "Allow individual read access"
ON public.connections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create new connections for themselves.
CREATE POLICY "Allow individual insert access"
ON public.connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connections.
CREATE POLICY "Allow individual update access"
ON public.connections
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own connections.
CREATE POLICY "Allow individual delete access"
ON public.connections
FOR DELETE
USING (auth.uid() = user_id);
