-- 1. DROP EXISTING TABLES (To reset schema and constraints)
-- We use CASCADE to remove dependent foreign keys and policies automatically
drop table if exists user_acknowledgments cascade;
drop table if exists media_content cascade;

-- 2. RE-CREATE TABLES WITHOUT STRICT FOREIGN KEYS TO auth.users
-- This prevents the "Key not present" (FK Violation) errors.
-- We just store the UUIDs.

create table media_content (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'directive' or 'conference'
  content text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  updated_by uuid -- Storing just the ID without hard constraint to avoid permission issues
);

create table user_acknowledgments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid, -- Storing just the ID
  content_id uuid references media_content(id) on delete cascade, -- Link to content is fine
  acknowledged_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, content_id)
);

-- 3. ENABLE RLS
alter table media_content enable row level security;
alter table user_acknowledgments enable row level security;

-- 4. CREATE PERMISSIVE POLICIES (Development Mode)
-- Allow ALL operations for everyone.
create policy "Enable all access for media_content" 
on media_content for all using (true) with check (true);

create policy "Enable all access for user_acknowledgments" 
on user_acknowledgments for all using (true) with check (true);
