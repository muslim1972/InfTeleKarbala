-- إضافة عمود audio_url لجدول messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- إنشاء Storage Bucket للرسائل الصوتية
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO NOTHING;

-- سياسة رفع الملفات: المستخدمون المسجلون فقط
CREATE POLICY "Users can upload voice messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-messages');

-- سياسة القراءة: الجميع (لأن الباكت عام)
CREATE POLICY "Anyone can read voice messages"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice-messages');

-- سياسة حذف الملفات: صاحب الملف فقط
CREATE POLICY "Users can delete own voice messages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice-messages' AND (storage.foldername(name))[1] = auth.uid()::text);
