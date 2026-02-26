-- Add admin_role column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT 'developer';

-- Update existing admins to be 'developer' by default to maintain access
UPDATE profiles 
SET admin_role = 'developer' 
WHERE role = 'admin' AND (admin_role IS NULL OR admin_role = '');

-- Add comment
COMMENT ON COLUMN profiles.admin_role IS 'Role of the admin: developer (full access), media (news only), etc.';
