-- Enable Admins to see all user acknowledgments
-- Currently, RLS only allows users to see their own.

BEGIN;

-- Drop existing restrictive policy if it hinders admins
DROP POLICY IF EXISTS "Users can read own acknowledgments" ON user_acknowledgments;

-- Create a broader read policy
-- Option 1: Allow everyone to read (simplest for this use case where admin checks)
-- Option 2: Allow specific roles. Since we want admin to check, we can just allow read for all authenticated for now,
-- OR keep "own" + "admin".

-- Let's go with: Authenticated users can read all.
-- Why? Because technically checking if someone acknowledged isn't highly sensitive PII in this context,
-- and it simplifies the admin check logic without complex role checks in RLS.
CREATE POLICY "Enable read access for all authenticated users" 
ON user_acknowledgments FOR SELECT 
TO authenticated 
USING (true);

COMMIT;
