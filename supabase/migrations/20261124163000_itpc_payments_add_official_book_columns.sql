-- ==============================================================================
-- هجرة إضافة حقول الكتاب الرسمي لجدول payments في سكيما itpc
-- المسار: supabase/migrations/20261124163000_itpc_payments_add_official_book_columns.sql
-- ==============================================================================

DO $$
BEGIN
    -- 1. إضافة عمود تاريخ الكتاب الرسمي
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'itpc' AND table_name = 'payments' AND column_name = 'official_book_date'
    ) THEN
        ALTER TABLE itpc.payments ADD COLUMN official_book_date DATE;
    END IF;

    -- 2. إضافة عمود وصف الكتاب الرسمي
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'itpc' AND table_name = 'payments' AND column_name = 'official_book_description'
    ) THEN
        ALTER TABLE itpc.payments ADD COLUMN official_book_description TEXT;
    END IF;
END $$;

-- إعادة تحميل كاش PostgREST فورياً
NOTIFY pgrst, 'reload schema';
