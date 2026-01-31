-- Add Audit Columns to Detail Tables
-- Adds tracking for who modified the record and when.

-- 1. Thanks Details
ALTER TABLE public.thanks_details ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.thanks_details ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.thanks_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. Committees Details
ALTER TABLE public.committees_details ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.committees_details ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.committees_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 3. Penalties Details
ALTER TABLE public.penalties_details ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.penalties_details ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.penalties_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 4. Leaves Details
ALTER TABLE public.leaves_details ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id);
ALTER TABLE public.leaves_details ADD COLUMN IF NOT EXISTS last_modified_by_name text;
ALTER TABLE public.leaves_details ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone DEFAULT timezone('utc'::text, now());
