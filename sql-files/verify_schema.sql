
-- سكربت للتحقق من أعمدة الجداول الموجودة في قاعدة البيانات
-- Run this in Supabase SQL Editor

SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name IN ('profiles', 'financial_records', 'administrative_summary', 'yearly_records')
ORDER BY 
    table_name, ordinal_position;
