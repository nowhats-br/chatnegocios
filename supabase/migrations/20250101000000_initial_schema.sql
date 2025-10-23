/*
          # [Operation Name]
          Initial Schema Creation

          ## Query Description: "This migration script establishes the complete database schema for the ChatNegocios application on Supabase. It creates all necessary tables, sets up relationships, and configures Row Level Security (RLS) to ensure data privacy. A trigger is also included to automatically create a user profile upon new user registration. This is a foundational script and is safe to run on a new Supabase project."
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "High"
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Tables Created: profiles, connections, contacts, tags, products, quick_responses, queues, teams, contact_tags, conversations, messages.
          - Functions Created: handle_new_user.
          - Triggers Created: on_auth_user_created.
          
          ## Security Implications:
          - RLS Status: Enabled on all user-data tables.
          - Policy Changes: Yes, creates SELECT, INSERT, UPDATE, DELETE policies for all tables.
          - Auth Requirements: Policies are based on the authenticated user's ID (auth.uid()).
          
          ## Performance Impact:
          - Indexes: Primary keys and foreign keys are indexed by default.
          - Triggers: A single trigger on auth.users for profile creation.
          - Estimated Impact: Low performance impact, standard setup.
          */

-- 1. PROFILES TABLE
-- Stores public user data and API settings.
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique,
  evolution_api_url text,
  evolution_api_key text
);
-- Comments
comment on table profiles is 'Profile data for each user.';
comment on column profiles.id is 'References the internal Supabase auth user.';
-- RLS
alter table profiles enable row level security;
create policy "Users can view their own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile." on profiles for update using (auth.uid() = id);

-- 2. HANDLE NEW USER TRIGGER
-- This trigger automatically creates a profile entry when a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;
-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. CONNECTIONS TABLE
-- Stores WhatsApp connection instances.
create table connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  instance_name text not null,
  status text not null,
  instance_data jsonb,
  created_at timestamptz default now() not null,
  unique(user_id, instance_name)
);
-- RLS
alter table connections enable row level security;
create policy "Users can manage their own connections." on connections for all using (auth.uid() = user_id);

-- 4. CONTACTS TABLE
-- Stores contacts associated with a user.
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  phone_number text not null,
  name text,
  avatar_url text,
  purchase_history jsonb,
  created_at timestamptz default now() not null,
  unique(user_id, phone_number)
);
-- RLS
alter table contacts enable row level security;
create policy "Users can manage their own contacts." on contacts for all using (auth.uid() = user_id);

-- 5. TAGS TABLE
-- Stores user-defined tags for organizing contacts.
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color text,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);
-- RLS
alter table tags enable row level security;
create policy "Users can manage their own tags." on tags for all using (auth.uid() = user_id);

-- 6. CONTACT_TAGS JOIN TABLE
-- Links contacts and tags in a many-to-many relationship.
create table contact_tags (
  contact_id uuid references contacts on delete cascade not null,
  tag_id uuid references tags on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  primary key (contact_id, tag_id)
);
-- RLS
alter table contact_tags enable row level security;
create policy "Users can manage their own contact tags." on contact_tags for all using (auth.uid() = user_id);

-- 7. CONVERSATIONS TABLE
-- Represents a chat conversation with a contact.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  contact_id uuid references contacts on delete cascade not null,
  connection_id uuid references connections on delete cascade,
  status text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
-- RLS
alter table conversations enable row level security;
create policy "Users can manage their own conversations." on conversations for all using (auth.uid() = user_id);

-- 8. MESSAGES TABLE
-- Stores individual messages within a conversation.
create table messages (
  id text primary key, -- Using text to accommodate IDs from external APIs like WhatsApp
  conversation_id uuid references conversations on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  sender_is_user boolean not null,
  content text,
  message_type text not null,
  created_at timestamptz default now() not null
);
-- RLS
alter table messages enable row level security;
create policy "Users can manage their own messages." on messages for all using (auth.uid() = user_id);

-- 9. QUICK RESPONSES TABLE
-- Stores templates for quick replies.
create table quick_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  shortcut text not null,
  message text not null,
  created_at timestamptz default now() not null,
  unique(user_id, shortcut)
);
-- RLS
alter table quick_responses enable row level security;
create policy "Users can manage their own quick responses." on quick_responses for all using (auth.uid() = user_id);

-- 10. PRODUCTS TABLE
-- Stores user's product catalog.
create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  price numeric not null,
  stock int default 0,
  image_url text,
  category text,
  created_at timestamptz default now() not null
);
-- RLS
alter table products enable row level security;
create policy "Users can manage their own products." on products for all using (auth.uid() = user_id);

-- 11. QUEUES TABLE
-- Stores user-defined queues for organizing teams/users.
create table queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);
-- RLS
alter table queues enable row level security;
create policy "Users can manage their own queues." on queues for all using (auth.uid() = user_id);

-- 12. TEAMS TABLE
-- Stores user-defined teams.
create table teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);
-- RLS
alter table teams enable row level security;
create policy "Users can manage their own teams." on teams for all using (auth.uid() = user_id);
