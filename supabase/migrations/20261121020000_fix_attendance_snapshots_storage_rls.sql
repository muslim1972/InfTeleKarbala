-- Migration: Fix Attendance Snapshots Storage RLS Policies
-- Enables seamless upload and viewing of biometric attendance face snapshots
-- Author: Eng. Muslim A. Abdul-Hassan & Deliberation Council
-- Date: 2026-11-21

DO $$
BEGIN
    -- Drop obsolete or broken policies on storage.objects for attendance-snapshots
    DROP POLICY IF EXISTS "Allow Upload Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Allow Update Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Read Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Public Read Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Public Upload Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Public Update Attendance Snapshots" ON storage.objects;
    DROP POLICY IF EXISTS "Supervisor Delete Attendance Snapshots" ON storage.objects;
END $$;

-- 1. Public Read Policy: Allow anyone (including supervisor timesheets and public verification) to view face snapshots
CREATE POLICY "Public Read Attendance Snapshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attendance-snapshots');

-- 2. Public Upload Policy: Allow employees (authenticated & anon storageClient) to insert snapshots
CREATE POLICY "Public Upload Attendance Snapshots"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'attendance-snapshots');

-- 3. Public Update Policy: Allow upserting snapshots in attendance-snapshots
CREATE POLICY "Public Update Attendance Snapshots"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'attendance-snapshots')
WITH CHECK (bucket_id = 'attendance-snapshots');

-- 4. Secure Delete Policy: Only authorized supervisors can delete attendance snapshots
CREATE POLICY "Supervisor Delete Attendance Snapshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'attendance-snapshots' 
    AND public.get_my_admin_role() = ANY (ARRAY['developer'::text, 'general'::text, 'it_supervisor'::text])
);
