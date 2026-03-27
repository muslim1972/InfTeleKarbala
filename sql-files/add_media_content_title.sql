-- ==================================================
-- إضافة عمود title لجدول media_content
-- لتخزين اسم/وصف الرابط المهم
-- ==================================================

ALTER TABLE public.media_content
ADD COLUMN IF NOT EXISTS title text;
