-- Force Fix user_acknowledgments foreign key constraint
-- This script handles the case where existing data violates the new constraint.
-- It will removed orphaned records first.

BEGIN;

-- 1. Remove orphaned records (User IDs that do not exist in profiles)
-- This is necessary because the previous error showed: Key (user_id)=(...) is not present in table "profiles".
DELETE FROM user_acknowledgments
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 2. Drop the incorrect constraint if it exists
ALTER TABLE user_acknowledgments 
DROP CONSTRAINT IF EXISTS user_acknowledgments_user_id_fkey;

-- 3. Add the correct constraint pointing to profiles
ALTER TABLE user_acknowledgments
ADD CONSTRAINT user_acknowledgments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id)
ON DELETE CASCADE;

COMMIT;
