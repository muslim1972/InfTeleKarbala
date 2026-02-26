
-- Add Auth Columns to profiles table
-- facilitating the move from app_users to profiles for authentication

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS password text, -- Storing plain text as per requirements for initial setup
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS avatar text;

-- Add constraints
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- Index for faster lookup during login
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);
