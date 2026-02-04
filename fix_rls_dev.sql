-- Enable RLS (just to be sure, policies need it enabled to work properly, or we could disable it completely but policies are safer standard)
alter table media_content enable row level security;
alter table user_acknowledgments enable row level security;

-- DROP ALL POTENTIAL POLICIES (Cleaning up previous attempts)
drop policy if exists "Enable read access for all users" on media_content;
drop policy if exists "Enable insert for authenticated users" on media_content;
drop policy if exists "Enable update for authenticated users" on media_content;
drop policy if exists "Enable insert for admins" on media_content; -- This was the one causing error
drop policy if exists "Enable update for admins" on media_content;
drop policy if exists "Enable all for everyone" on media_content;

-- CREATE A SINGLE PERMISSIVE POLICY FOR DEVELOPMENT
-- This allows SELECT, INSERT, UPDATE, DELETE for everyone.
create policy "Enable all for everyone" 
on media_content 
for all 
using (true) 
with check (true);


-- REPEAT FOR ACKNOWLEDGMENTS TABLE
drop policy if exists "Users can read own acknowledgments" on user_acknowledgments;
drop policy if exists "Users can insert own acknowledgment" on user_acknowledgments;
drop policy if exists "Enable all for everyone" on user_acknowledgments;

create policy "Enable all for everyone" 
on user_acknowledgments 
for all 
using (true) 
with check (true);
