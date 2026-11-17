-- Migration: HR Movements RLS Policies and Book Number Columns
-- Kernel: BE-HR-01
-- Date: 2026-11-16

-- 1. Ensure book_number columns exist for committees and penalties
ALTER TABLE public.committees_details ADD COLUMN IF NOT EXISTS book_number TEXT;
ALTER TABLE public.penalties_details ADD COLUMN IF NOT EXISTS book_number TEXT;

-- 2. Ensure RLS is enabled
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS policies for thanks_details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'thanks_details' AND policyname = 'Users view own thanks'
    ) THEN
        CREATE POLICY "Users view own thanks" ON public.thanks_details
            FOR SELECT USING (((auth.uid() = user_id) OR is_admin()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'thanks_details' AND policyname = 'Admins manage thanks'
    ) THEN
        CREATE POLICY "Admins manage thanks" ON public.thanks_details
            FOR ALL USING (is_admin());
    END IF;
END $$;

-- 4. Add RLS policies for committees_details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'committees_details' AND policyname = 'Users view own committees'
    ) THEN
        CREATE POLICY "Users view own committees" ON public.committees_details
            FOR SELECT USING (((auth.uid() = user_id) OR is_admin()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'committees_details' AND policyname = 'Admins manage committees'
    ) THEN
        CREATE POLICY "Admins manage committees" ON public.committees_details
            FOR ALL USING (is_admin());
    END IF;
END $$;

-- 5. Ensure grants
GRANT SELECT ON public.thanks_details TO authenticated;
GRANT SELECT ON public.committees_details TO authenticated;
GRANT SELECT ON public.penalties_details TO authenticated;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
