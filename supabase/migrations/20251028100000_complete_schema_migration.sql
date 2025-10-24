/*
          # [Full Schema] Initial Database Schema
          [This script sets up the entire database schema from scratch, including tables, enums, relationships, functions, triggers, and Row Level Security (RLS) policies. It is designed to be run on a clean project or to replace an existing schema.]

          ## Query Description: [This operation will create the entire database structure for the Chatvendas application. If you have existing tables with the same names, they might need to be dropped first. This script is foundational and critical for the application to work. It includes security policies to ensure data privacy between users.]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "High"
          - Requires-Backup: true
          - Reversible: false
          
          ## Structure Details:
          - Tables Created: profiles, connections, contacts, tags, contact_tags, conversations, messages, products, quick_responses, queues, teams, team_members.
          - Enums Created: connection_status, conversation_status, message_type.
          - Functions Created: handle_new_user, ensure_profile_exists, update_conversation_timestamp.
          - Triggers Created: on_auth_user_created, on_new_message_update_conversation.
          
          ## Security Implications:
          - RLS Status: Enabled on all tables.
          - Policy Changes: Yes, creates all necessary RLS policies.
          - Auth Requirements: Policies are based on `auth.uid()`.
          
          ## Performance Impact:
          - Indexes: Added on foreign keys and frequently queried columns.
          - Triggers: Adds triggers for profile creation and timestamp updates.
          - Estimated Impact: Low on a new database.
          */

-- ========= ENUMS (CUSTOM TYPES) =========
CREATE TYPE public.connection_status AS ENUM ('CONNECTED', 'DISCONNECTED', 'WAITING_QR_CODE', 'INITIALIZING', 'PAUSED');
CREATE TYPE public.conversation_status AS ENUM ('new', 'active', 'pending', 'resolved');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'audio', 'video', 'file', 'product');

-- ========= TABLE: profiles =========
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    evolution_api_url text,
    evolution_api_key text
);
COMMENT ON TABLE public.profiles IS 'Stores user-specific settings, like API keys.';

-- ========= TABLE: connections =========
CREATE TABLE public.connections (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_name text NOT NULL,
    status public.connection_status NOT NULL DEFAULT 'DISCONNECTED',
    instance_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_connections_user_id ON public.connections(user_id);
COMMENT ON TABLE public.connections IS 'Stores WhatsApp connection instances for each user.';

-- ========= TABLE: contacts =========
CREATE TABLE public.contacts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    name text,
    avatar_url text,
    purchase_history jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_contacts_user_phone ON public.contacts(user_id, phone_number);
COMMENT ON TABLE public.contacts IS 'Stores contacts (clients) for each user.';

-- ========= TABLE: tags =========
CREATE TABLE public.tags (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
COMMENT ON TABLE public.tags IS 'Defines tags that can be applied to contacts.';

-- ========= TABLE: contact_tags (JOIN) =========
CREATE TABLE public.contact_tags (
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX idx_contact_tags_user_id ON public.contact_tags(user_id);
COMMENT ON TABLE public.contact_tags IS 'Associates tags with contacts.';

-- ========= TABLE: conversations =========
CREATE TABLE public.conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL,
    status public.conversation_status NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_conversations_user_contact ON public.conversations(user_id, contact_id);
COMMENT ON TABLE public.conversations IS 'Represents a chat session with a contact.';

-- ========= TABLE: messages =========
CREATE TABLE public.messages (
    id text NOT NULL PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_is_user boolean NOT NULL,
    content text,
    message_type public.message_type NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
COMMENT ON TABLE public.messages IS 'Stores all messages within conversations.';

-- ========= TABLE: products =========
CREATE TABLE public.products (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    price numeric(10, 2) NOT NULL,
    stock integer,
    image_url text,
    category text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_user_id ON public.products(user_id);
COMMENT ON TABLE public.products IS 'Product catalog for each user.';

-- ========= TABLE: quick_responses =========
CREATE TABLE public.quick_responses (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shortcut text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_quick_responses_user_shortcut ON public.quick_responses(user_id, shortcut);
COMMENT ON TABLE public.quick_responses IS 'Canned responses for quick replies.';

-- ========= TABLE: queues =========
CREATE TABLE public.queues (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_queues_user_id ON public.queues(user_id);
COMMENT ON TABLE public.queues IS 'Support queues for organizing teams/users.';

-- ========= TABLE: teams =========
CREATE TABLE public.teams (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_user_id ON public.teams(user_id);
COMMENT ON TABLE public.teams IS 'User-created teams.';

-- ========= TABLE: team_members (JOIN) =========
CREATE TABLE public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
COMMENT ON TABLE public.team_members IS 'Associates users with teams.';

-- ========= FUNCTIONS & TRIGGERS =========

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to automatically create a user profile upon registration.';

-- Trigger to call the function when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC Function for clients to ensure their profile exists (for users created before the trigger)
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.ensure_profile_exists() IS 'RPC function to allow users to create their own profile if it does not exist.';

-- Function to update conversation timestamp on new message
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.update_conversation_timestamp() IS 'Updates the `updated_at` field in the `conversations` table whenever a new message is inserted.';

-- Trigger to call the function on new message
CREATE TRIGGER on_new_message_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.update_conversation_timestamp();

-- ========= ROW LEVEL SECURITY (RLS) =========

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS for all other tables
DO $$
DECLARE
  t_name TEXT;
BEGIN
  FOR t_name IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT IN ('profiles')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
    EXECUTE format('CREATE POLICY "Users can manage their own data" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t_name);
  END LOOP;
END;
$$;
