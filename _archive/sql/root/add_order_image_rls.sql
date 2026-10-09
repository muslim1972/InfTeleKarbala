CREATE POLICY "Public Read order-image" ON storage.objects FOR SELECT USING (bucket_id = 'order-image');
CREATE POLICY "Public Upload order-image" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-image');
CREATE POLICY "Public Update order-image" ON storage.objects FOR UPDATE USING (bucket_id = 'order-image');
CREATE POLICY "Public Delete order-image" ON storage.objects FOR DELETE USING (bucket_id = 'order-image');
