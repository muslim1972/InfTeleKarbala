-- 1. DROP EXISTING TABLES (Resetting to fix schema references)
drop table if exists user_acknowledgments cascade;
drop table if exists media_content cascade;

-- 2. CREATE TABLES WITH CORRECT FOREIGN KEYS (referencing 'app_users' NOT 'auth.users')

create table media_content (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'directive' or 'conference'
  content text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  -- CORRECT REFERENCE: Linking to the actual apps user table
  updated_by uuid references app_users(id)
);

create table user_acknowledgments (
  id uuid default gen_random_uuid() primary key,
  -- CORRECT REFERENCE: Linking to the actual apps user table
  user_id uuid references app_users(id),
  content_id uuid references media_content(id) on delete cascade,
  acknowledged_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, content_id)
);

-- 3. ENABLE ROW LEVEL SECURITY
alter table media_content enable row level security;
alter table user_acknowledgments enable row level security;

-- 4. CREATE PERMISSIVE POLICIES
-- Since we rely on app logic for auth (via app_users), we keep RLS permissive for the API interaction
-- assuming the frontend/backend logic handles the actual permission checks (admin vs user).

create policy "Enable all access for media_content" 
on media_content for all using (true) with check (true);

create policy "Enable all access for user_acknowledgments" 
on user_acknowledgments for all using (true) with check (true);
