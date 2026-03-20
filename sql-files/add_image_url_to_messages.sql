-- إضافة عمود image_url إلى جدول messages لدعم إرسال الصور
-- يتم تخزين رابط الصورة من Supabase Storage bucket: image-message

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url text NULL;

-- تعليق توضيحي على العمود
COMMENT ON COLUMN public.messages.image_url IS 'رابط الصورة المرفقة بالرسالة من Supabase Storage bucket image-message';
