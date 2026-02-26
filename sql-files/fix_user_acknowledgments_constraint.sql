-- Fix user_acknowledgments foreign key constraint
-- The original table referenced 'app_users' which effectively doesn't exist or isn't used.
-- We need to point it to 'profiles' (which is the main user table linked to auth.users).

BEGIN;

-- 1. Drop the incorrect constraint
ALTER TABLE user_acknowledgments 
DROP CONSTRAINT IF EXISTS user_acknowledgments_user_id_fkey;

-- 2. Add the correct constraint pointing to profiles
ALTER TABLE user_acknowledgments
ADD CONSTRAINT user_acknowledgments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

COMMIT;
