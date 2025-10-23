/*
# [Full Schema &amp; RLS Policies]
This script defines the complete database schema, enables Row Level Security (RLS) on all tables, and creates policies to ensure users can only access their own data. It also adds a trigger to automatically create a user profile upon registration.

## Query Description: This is a foundational migration. It sets up all tables and security rules from scratch. If you have existing data that does not conform to this structure, it may cause issues. It is highly recommended to apply this to a clean database or after backing up your data. This script is designed to be idempotent where possible, but caution is advised.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "High"
- Requires-Backup: true
- Reversible: false

## Structure Details:
- Creates tables: profiles, connections, contacts, tags, contact_tags, conversations, messages, products, quick_responses, queues, teams, team_members.
- Creates function: handle_new_user.
- Creates trigger: on_auth_user_created.
- Enables RLS on all tables and adds user-specific access policies.

## Security Implications:
- RLS Status: Enabled on all application tables.
- Policy Changes: Yes, adds policies to restrict data access to the owner (user).
- Auth Requirements: Policies are based on `auth.uid()`.

## Performance Impact:
- Indexes: Primary keys and foreign keys are indexed by default.
- Triggers: Adds one trigger on `auth.users` table.
- Estimated Impact: Low performance impact on a small to medium scale. The trigger is lightweight.
*/

-- 1. PROFILES TABLE
-- Stores user-specific settings like API keys.
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    evolution_api_url text,
    evolution_api_key text
);
COMMENT ON TABLE public.profiles IS 'Stores user-specific profile information and settings.';
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. HANDLE NEW USER FUNCTION &amp; TRIGGER
-- Automatically create a profile for new users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. CONNECTIONS TABLE
-- Stores WhatsApp connection instances.
CREATE TABLE IF NOT EXISTS public.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_name text NOT NULL,
    status text DEFAULT 'DISCONNECTED'::text NOT NULL,
    instance_data jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS connections_user_id_instance_name_idx ON public.connections(user_id, instance_name);
COMMENT ON TABLE public.connections IS 'Stores WhatsApp connection instances linked to users.';
-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
-- Policies for connections
DROP POLICY IF EXISTS "Users can manage their own connections." ON public.connections;
CREATE POLICY "Users can manage their own connections." ON public.connections FOR ALL USING (auth.uid() = user_id);

-- 4. CONTACTS TABLE
-- Stores contacts from WhatsApp.
CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    name text,
    avatar_url text,
    purchase_history jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_id_phone_number_idx ON public.contacts(user_id, phone_number);
COMMENT ON TABLE public.contacts IS 'Stores contacts associated with a user.';
-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
-- Policies for contacts
DROP POLICY IF EXISTS "Users can manage their own contacts." ON public.contacts;
CREATE POLICY "Users can manage their own contacts." ON public.contacts FOR ALL USING (auth.uid() = user_id);

-- 5. TAGS TABLE
-- Stores user-defined tags for contacts.
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.tags IS 'User-defined tags for categorizing contacts.';
-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
-- Policies for tags
DROP POLICY IF EXISTS "Users can manage their own tags." ON public.tags;
CREATE POLICY "Users can manage their own tags." ON public.tags FOR ALL USING (auth.uid() = user_id);

-- 6. CONTACT_TAGS (JOIN TABLE)
-- Links contacts and tags.
CREATE TABLE IF NOT EXISTS public.contact_tags (
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
COMMENT ON TABLE public.contact_tags IS 'Join table linking contacts to tags.';
-- Enable RLS
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
-- Policies for contact_tags
DROP POLICY IF EXISTS "Users can manage their own contact tags." ON public.contact_tags;
CREATE POLICY "Users can manage their own contact tags." ON public.contact_tags FOR ALL USING (auth.uid() = user_id);

-- 7. CONVERSATIONS TABLE
-- Stores conversation sessions.
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
    status text DEFAULT 'new'::text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_id_contact_id_idx ON public.conversations(user_id, contact_id);
COMMENT ON TABLE public.conversations IS 'Tracks conversation sessions with contacts.';
-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
-- Policies for conversations
DROP POLICY IF EXISTS "Users can manage their own conversations." ON public.conversations;
CREATE POLICY "Users can manage their own conversations." ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- 8. MESSAGES TABLE
-- Stores individual messages within a conversation.
CREATE TABLE IF NOT EXISTS public.messages (
    id text NOT NULL PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_is_user boolean DEFAULT false NOT NULL,
    content text,
    message_type text DEFAULT 'text'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.messages IS 'Stores individual messages within a conversation.';
-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- Policies for messages
DROP POLICY IF EXISTS "Users can manage their own messages." ON public.messages;
CREATE POLICY "Users can manage their own messages." ON public.messages FOR ALL USING (auth.uid() = user_id);

-- 9. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    stock integer,
    image_url text,
    category text,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.products IS 'Stores user''s product catalog.';
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own products." ON public.products;
CREATE POLICY "Users can manage their own products." ON public.products FOR ALL USING (auth.uid() = user_id);

-- 10. QUICK_RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.quick_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shortcut text NOT NULL,
    message text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS quick_responses_user_id_shortcut_idx ON public.quick_responses(user_id, shortcut);
COMMENT ON TABLE public.quick_responses IS 'Stores templates for quick replies.';
ALTER TABLE public.quick_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own quick responses." ON public.quick_responses;
CREATE POLICY "Users can manage their own quick responses." ON public.quick_responses FOR ALL USING (auth.uid() = user_id);

-- 11. QUEUES TABLE
CREATE TABLE IF NOT EXISTS public.queues (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.queues IS 'Defines service queues for organizing teams/users.';
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own queues." ON public.queues;
CREATE POLICY "Users can manage their own queues." ON public.queues FOR ALL USING (auth.uid() = user_id);

-- 12. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.teams IS 'Defines user teams for collaborative work.';
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own teams." ON public.teams;
CREATE POLICY "Users can manage their own teams." ON public.teams FOR ALL USING (auth.uid() = user_id);

-- 13. TEAM_MEMBERS (JOIN TABLE)
CREATE TABLE IF NOT EXISTS public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (team_id, user_id)
);
COMMENT ON TABLE public.team_members IS 'Join table linking users to teams.';
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
-- This policy allows team owners to manage members.
DROP POLICY IF EXISTS "Team owners can manage their team members." ON public.team_members;
CREATE POLICY "Team owners can manage their team members." ON public.team_members
FOR ALL
USING (
  auth.uid() IN (SELECT user_id FROM public.teams WHERE id = team_id)
);
