-- Create bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-image', 'order-image', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for order-image bucket
-- Enable RLS on storage.objects if not already
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to insert order-image' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow authenticated users to insert order-image" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'order-image');
    END IF;
END $$;

-- Allow authenticated users to update files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to update order-image' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow authenticated users to update order-image" 
        ON storage.objects FOR UPDATE 
        TO authenticated 
        USING (bucket_id = 'order-image');
    END IF;
END $$;

-- Allow public read access to files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to order-image' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow public read access to order-image" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'order-image');
    END IF;
END $$;
