-- إضافة أعمدة المرفقات إلى جدول الرسائل
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS file_url TEXT,
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- إنشاء دلو التخزين للملفات (chat-files)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات دلو (chat-files)
-- 1. المشاهدة (للكل)
CREATE POLICY "Public Access for chat-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-files');

-- 2. الإضافة (للمستخدمين المسجلين فقط)
CREATE POLICY "Authenticated users can upload chat-files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat-files' 
    AND auth.role() = 'authenticated'
);

-- 3. التعديل والحذف (لصاحب الملف فقط بناءً على المجلد)
CREATE POLICY "Users can update their own chat-files"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'chat-files' 
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Users can delete their own chat-files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'chat-files' 
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
