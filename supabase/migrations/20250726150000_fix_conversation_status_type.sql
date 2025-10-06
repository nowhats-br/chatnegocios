DO $$
BEGIN
    -- Step 1: Create the ENUM type if it doesn't exist.
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversationstatus') THEN
        CREATE TYPE public."ConversationStatus" AS ENUM ('new', 'active', 'pending', 'resolved');
    END IF;

    -- Step 2: Alter the column type to use the ENUM, if it's not already using it.
    -- This handles the case where the column is still of type 'text' or 'varchar'.
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'status') != 'USER-DEFINED' THEN
        ALTER TABLE public.conversations
            ALTER COLUMN status TYPE public."ConversationStatus" USING status::text::"ConversationStatus";
    END IF;

    -- Step 3: Set the default value for the column. This is safe to run now.
    ALTER TABLE public.conversations
        ALTER COLUMN status SET DEFAULT 'new';

END;
$$;
