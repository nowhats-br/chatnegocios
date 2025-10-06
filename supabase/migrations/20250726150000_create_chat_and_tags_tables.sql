/*
          # [Operation] Create Chat and Tag Tables
          [This script creates the core tables required for the chat functionality (`conversations`, `messages`) and for the contact tagging system (`tags`, `contact_tags`). It also enables Row Level Security on all new tables to ensure data privacy.]

          ## Query Description: [This operation is safe and structural. It adds new tables to the database without modifying or deleting existing data. It is a necessary step to enable the upcoming chat and contact management features.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Creates table `conversations` to manage chat sessions.
          - Creates table `messages` to store individual messages.
          - The `tags` and `contact_tags` tables were defined in a previous migration but might not have been created due to errors. This script ensures they exist.
          
          ## Security Implications:
          - RLS Status: Enabled on all new tables.
          - Policy Changes: Yes, new policies are added for select, insert, update, delete based on `user_id`.
          - Auth Requirements: Users must be authenticated to interact with these tables.
          
          ## Performance Impact:
          - Indexes: Primary keys and foreign keys are indexed by default.
          - Triggers: None.
          - Estimated Impact: Low.
          */

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id bigint NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage their conversations" ON public.conversations
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_is_user boolean NOT NULL,
    content text,
    message_type text NOT NULL DEFAULT 'text'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to access messages in their conversations" ON public.messages
    FOR ALL
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE (conversations.id = messages.conversation_id))));

-- The following tables for tags might have failed before, so we use IF NOT EXISTS to be safe.
-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT tags_pkey PRIMARY KEY (id)
);
ALTER TABLE IF EXISTS public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to manage their tags" ON public.tags;
CREATE POLICY "Allow authenticated users to manage their tags" ON public.tags
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create contact_tags join table
CREATE TABLE IF NOT EXISTS public.contact_tags (
    contact_id bigint NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    CONSTRAINT contact_tags_pkey PRIMARY KEY (contact_id, tag_id)
);
ALTER TABLE IF EXISTS public.contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage tags for their contacts" ON public.contact_tags;
CREATE POLICY "Allow users to manage tags for their contacts" ON public.contact_tags
    FOR ALL
    TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM contacts
  WHERE ((contacts.id = contact_tags.contact_id) AND (contacts.user_id = auth.uid())))));
