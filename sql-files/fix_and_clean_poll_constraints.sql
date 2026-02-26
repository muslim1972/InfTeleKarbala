-- Fix and Clean Poll Constraints
-- This script first removes orphan records (responses/comments from users who don't exist in 'profiles')
-- Then it safely applies the foreign key constraints.

BEGIN;

-- 1. Clean up invalid data in poll_responses
DELETE FROM poll_responses 
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 2. Clean up invalid data in poll_comments
DELETE FROM poll_comments 
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 3. Fix poll_responses constraint
ALTER TABLE poll_responses 
DROP CONSTRAINT IF EXISTS poll_responses_user_id_fkey;

ALTER TABLE poll_responses
ADD CONSTRAINT poll_responses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

-- 4. Fix poll_comments constraint
ALTER TABLE poll_comments 
DROP CONSTRAINT IF EXISTS poll_comments_user_id_fkey;

ALTER TABLE poll_comments
ADD CONSTRAINT poll_comments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

COMMIT;
