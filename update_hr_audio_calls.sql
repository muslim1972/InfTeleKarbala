-- تحديث جدول hr_audio_calls لإضافة الميزات الاحترافية
ALTER TABLE public.hr_audio_calls 
ADD COLUMN IF NOT EXISTS receiver_track_name TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- التأكد من تفعيل Realtime (إذا لم يكن مفعلاً سابقاً)
-- ALTER PUBLICATION supabase_realtime ADD TABLE hr_audio_calls;
