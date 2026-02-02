-- 1. Add avatar_url column to app_users table
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the storage bucket (if not exists via UI, but policies are key)
-- Note: Buckets often need UI creation to set Public Access easily, but this helps.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatar-images', 'avatar-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for 'avatar-images'

-- Policy: Allow public read access to all images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatar-images' );

-- Policy: Allow authenticated users to upload their own avatar
-- Note: Since we are using simple filename strategies (e.g., user_id-timestamp), 
-- we can allow insert for any auth user. strict path checking is better but keeping it simple.
CREATE POLICY "Auth Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatar-images' );

-- Policy: Allow users to update their own avatar (delete/overwrite logic handled by app usually)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatar-images' );

-- Policy: Allow users to delete their own avatar (optional, if we want cleanup)
CREATE POLICY "Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatar-images' );
