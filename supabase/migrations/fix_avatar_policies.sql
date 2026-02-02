-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Re-create policies allowing 'anon' (public) access since we use custom auth

-- Policy: Allow public read access (Viewer)
CREATE POLICY "Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatar-images' );

-- Policy: Allow public insert (Upload)
-- Warning: This allows anyone with the API key to upload to this bucket. 
-- Since we use custom auth without Supabase token, this is necessary for now.
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatar-images' );

-- Policy: Allow public update (Replace avatar)
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatar-images' );

-- Policy: Allow public delete (Cleanup)
CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'avatar-images' );
