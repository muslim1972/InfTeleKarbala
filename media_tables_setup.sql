-- Create table for media content (Directives & Conferences)
-- This stores the text content that Admins write.
create table if not exists media_content (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- Values: 'directive' (توجيهات) or 'conference' (مؤتمرات)
  content text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  updated_by uuid references auth.users(id)
);

-- Create table for User Acknowledgments
-- This tracks which users have clicked "تبلغت" (Acknowledged) for a specific directive.
create table if not exists user_acknowledgments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  content_id uuid references media_content(id),
  acknowledged_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, content_id) -- Prevent duplicate acknowledgments for the same directive
);

-- RLS Policies (Row Level Security) - Optional but recommended for security
alter table media_content enable row level security;
alter table user_acknowledgments enable row level security;

-- Allow everyone to read media content
create policy "Enable read access for all users" on media_content for select using (true);

-- Allow admins to insert/update media content (assuming you have an admin role logic, simplify for now to authenticated if needed, or stick to direct Supabase dashboard usage)
create policy "Enable insert for authenticated users" on media_content for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on media_content for update using (auth.role() = 'authenticated');

-- Allow users to read their own acknowledgments
create policy "Users can read own acknowledgments" on user_acknowledgments for select using (auth.uid() = user_id);

-- Allow users to insert their own acknowledgment
create policy "Users can insert own acknowledgment" on user_acknowledgments for insert with check (auth.uid() = user_id);
