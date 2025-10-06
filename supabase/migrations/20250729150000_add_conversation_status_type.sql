DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationStatus') THEN
        CREATE TYPE public."ConversationStatus" AS ENUM ('new', 'active', 'pending', 'resolved');
    END IF;
END$$;

ALTER TABLE public.conversations
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.conversations
    ALTER COLUMN status TYPE public."ConversationStatus" USING status::text::public."ConversationStatus";

ALTER TABLE public.conversations
    ALTER COLUMN status SET DEFAULT 'new';
