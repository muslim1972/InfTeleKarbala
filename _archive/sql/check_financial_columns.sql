-- فحص أعمدة جدول financial_records
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'financial_records'
ORDER BY ordinal_position;
