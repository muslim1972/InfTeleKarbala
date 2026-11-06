SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'financial_records' AND is_nullable = 'NO';
