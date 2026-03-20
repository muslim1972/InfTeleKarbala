-- سياسات RLS لـ Storage Bucket: image-message
-- يجب تنفيذ هذا السكربت في Supabase SQL Editor

-- سياسة رفع الملفات: المستخدمون المسجلون فقط
CREATE POLICY "Users can upload image messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'image-message');

-- سياسة القراءة: الجميع (لأن الباكت عام)
CREATE POLICY "Anyone can read image messages"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'image-message');

-- سياسة حذف الملفات: صاحب الملف فقط
CREATE POLICY "Users can delete own image messages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'image-message' AND (storage.foldername(name))[1] = auth.uid()::text);
