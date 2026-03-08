-- سكربت لتصحيح جدول الرسائل وإضافة عمود حالة القراءة (is_read)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- إذا أردت تحديث الرسائل القديمة لتكون "مقروءة" افتراضياً حتى لا تظهر كإشعارات قديمة متراكمة:
UPDATE public.messages SET is_read = true WHERE is_read IS NULL OR is_read = false;
