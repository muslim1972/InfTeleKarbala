-- 20261119170000_profiles_retirement_lifecycle.sql
-- إضافة حقول منظومة التقاعد في جدول profiles

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_retired BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS retirement_date DATE NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS retirement_note TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_retired ON profiles(is_retired);
CREATE INDEX IF NOT EXISTS idx_profiles_retirement_date ON profiles(retirement_date);

-- إشعار PostgREST بتحديث المخطط فوراً
NOTIFY pgrst, 'reload schema';
