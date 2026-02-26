-- 1. Update Polls Table to Support Categories (Media vs Training)
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS category text DEFAULT 'media';

-- Ensure all existing polls default to media
UPDATE public.polls SET category = 'media' WHERE category IS NULL;

-- 2. Fix the foreign key constraint that was causing the 409 Conflict error when new users try to create polls.
-- Clean up any orphaned polls that belong to users who no longer exist in the profiles table
DELETE FROM public.polls WHERE created_by NOT IN (SELECT id FROM public.profiles);

-- The polls table was referencing an old "app_users" table instead of the standard "profiles" table.
ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
ALTER TABLE public.polls ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
