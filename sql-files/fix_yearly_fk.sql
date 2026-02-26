-- إصلاح FK في yearly_records ليشير إلى profiles بدل app_users
ALTER TABLE yearly_records DROP CONSTRAINT IF EXISTS yearly_records_user_id_fkey;

ALTER TABLE yearly_records 
ADD CONSTRAINT yearly_records_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
