BEGIN;
DROP POLICY IF EXISTS "Users can upload voice messages" ON storage.objects;
CREATE POLICY "Users can upload voice messages"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'voice-messages'::text AND auth.role() = 'authenticated'::text);
COMMIT;
