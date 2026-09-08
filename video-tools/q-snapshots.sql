-- جرد النسخ الحالية
SELECT id, snapshot_name, snapshot_month, is_active, created_at
FROM public.monthly_snapshots
ORDER BY created_at DESC;

-- بنية جدول النسخ
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'monthly_snapshots' AND table_schema = 'public'
ORDER BY ordinal_position;
