-- Comprehensive fix for the 'connections' table user reference issue.

-- Step 1: Drop all existing policies on the 'connections' table to remove dependencies.
DROP POLICY IF EXISTS "Users can view their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can create connections for themselves." ON public.connections;
DROP POLICY IF EXISTS "Users can update their own connections." ON public.connections;
DROP POLICY IF EXISTS "Users can delete their own connections." ON public.connections;
DROP POLICY IF EXISTS "Enable read access for own connections" ON public.connections;
DROP POLICY IF EXISTS "Enable insert for own connections" ON public.connections;
DROP POLICY IF EXISTS "Enable update for own connections" ON public.connections;
DROP POLICY IF EXISTS "Enable delete for own connections" ON public.connections;


DO $$
BEGIN
  -- Step 2: Check if the incorrect 'owner_id' column exists.
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'owner_id') THEN
    
    -- Step 3: Check if the correct 'user_id' column ALSO exists.
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'user_id') THEN
      -- If both exist, the 'owner_id' is redundant. Drop it.
      ALTER TABLE public.connections DROP COLUMN owner_id;
    ELSE
      -- If only 'owner_id' exists, rename it to 'user_id'. This is the ideal correction.
      ALTER TABLE public.connections RENAME COLUMN owner_id TO user_id;
    END IF;
  
  END IF;

  -- Step 4: Ensure the 'user_id' column exists. If it was missing entirely, add it.
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'connections' AND column_name = 'user_id') THEN
    ALTER TABLE public.connections ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Step 5: Ensure the 'user_id' column is not nullable.
  ALTER TABLE public.connections ALTER COLUMN user_id SET NOT NULL;

END $$;


-- Step 6: Re-enable Row Level Security and create the correct policies.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

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
