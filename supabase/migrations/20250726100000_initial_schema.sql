/*
# [Initial Schema Setup]
This script sets up the initial database schema for the EvoChat application.
It creates the core tables for managing user profiles, WhatsApp connections, products, contacts, and quick responses.
It also establishes Row Level Security (RLS) policies to ensure data privacy and security from the start.

## Query Description: [This operation will create the foundational tables for the application. No existing data will be affected as these are all new tables. This is a safe, structural change required for the application to function correctly.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Tables Created: profiles, connections, products, contacts, quick_responses
- Types Created: connection_status
- Triggers Created: on_auth_user_created

## Security Implications:
- RLS Status: Enabled on all new tables.
- Policy Changes: Yes, initial policies are created for all tables.
- Auth Requirements: Policies are based on authenticated user roles.

## Performance Impact:
- Indexes: Primary keys and foreign keys are indexed by default.
- Triggers: A trigger is added to automatically create user profiles.
- Estimated Impact: Low, as this is the initial setup.
*/

-- 1. Create ENUM type for connection status
CREATE TYPE public.connection_status AS ENUM (
    'CONNECTED',
    'DISCONNECTED',
    'WAITING_QR_CODE',
    'LOADING'
);

-- 2. Create Profiles table to store user data
-- This table will be linked to the auth.users table
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    role text DEFAULT 'agent'::text,
    updated_at timestamp with time zone
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Create Connections table
CREATE TABLE public.connections (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    instance_name text NOT NULL UNIQUE,
    status public.connection_status DEFAULT 'DISCONNECTED'::public.connection_status,
    api_key text,
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up RLS for connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections."
ON public.connections FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create connections for themselves."
ON public.connections FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own connections."
ON public.connections FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own connections."
ON public.connections FOR DELETE USING (auth.uid() = owner_id);


-- 4. Create Products table
CREATE TABLE public.products (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    description text,
    price numeric(10, 2) NOT NULL DEFAULT 0,
    stock integer NOT NULL DEFAULT 0,
    image_url text,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all products."
ON public.products FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users with 'admin' or 'agent' role can manage products."
ON public.products FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent')
);


-- 5. Create Contacts table
CREATE TABLE public.contacts (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text,
    phone_number text NOT NULL UNIQUE,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up RLS for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contacts."
ON public.contacts FOR ALL USING (auth.role() = 'authenticated');


-- 6. Create Quick Responses table
CREATE TABLE public.quick_responses (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    shortcut text NOT NULL,
    message text NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up RLS for quick_responses
ALTER TABLE public.quick_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own quick responses or view global ones."
ON public.quick_responses FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);


-- 7. Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
