-- ========================================
-- إصلاح FK في thanks_details و committees_details
-- نفس مشكلة yearly_records - FK يشير لـ app_users بدل profiles
-- ========================================

-- 1. إصلاح thanks_details
ALTER TABLE thanks_details DROP CONSTRAINT IF EXISTS thanks_details_user_id_fkey;
ALTER TABLE thanks_details 
ADD CONSTRAINT thanks_details_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. إصلاح committees_details
ALTER TABLE committees_details DROP CONSTRAINT IF EXISTS committees_details_user_id_fkey;
ALTER TABLE committees_details 
ADD CONSTRAINT committees_details_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
