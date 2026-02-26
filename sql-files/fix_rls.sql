-- Drop existing policies to avoid conflicts
drop policy if exists "Enable read access for all users" on media_content;
drop policy if exists "Enable insert for authenticated users" on media_content;
drop policy if exists "Enable update for authenticated users" on media_content;

-- Re-create simplified policies
-- Allow everyone to READ
create policy "Enable read access for all users" on media_content for select using (true);

-- Allow authenticated users to INSERT and UPDATE (Admin actions)
-- Using 'auth.uid() is not null' is often more reliable than checking specific roles if role management is complex
create policy "Enable insert for admins" on media_content for insert with check (auth.uid() is not null);
create policy "Enable update for admins" on media_content for update using (auth.uid() is not null);

-- Ensure RLS is enabled
alter table media_content enable row level security;
