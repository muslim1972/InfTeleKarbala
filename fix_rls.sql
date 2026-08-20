BEGIN;
DROP POLICY IF EXISTS "Users can upload image messages" ON storage.objects;
CREATE POLICY "Users can upload image messages"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'image-message'::text AND auth.role() = 'authenticated'::text);
COMMIT;
