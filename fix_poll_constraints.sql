-- Fix poll_responses and poll_comments foreign key constraints
-- These tables likely reference 'app_users' which is not the active user table.
-- They should reference 'profiles' (or auth.users directly, but profiles is safer for public schema).

BEGIN;

-- 1. Fix poll_responses
ALTER TABLE poll_responses 
DROP CONSTRAINT IF EXISTS poll_responses_user_id_fkey;

ALTER TABLE poll_responses
ADD CONSTRAINT poll_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

-- 2. Fix poll_comments (preventative)
ALTER TABLE poll_comments 
DROP CONSTRAINT IF EXISTS poll_comments_user_id_fkey;

ALTER TABLE poll_comments
ADD CONSTRAINT poll_comments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

COMMIT;
