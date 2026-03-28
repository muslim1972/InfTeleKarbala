-- ==================================================
-- سكربت استعلامي لمعرفة هيكل الجداول الفعالة
-- نفّذ هذا في Supabase SQL Editor وأرسل لي النتيجة
-- ==================================================

SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'profiles',
        'financial_records',
        'yearly_records',
        'thanks_details',
        'committees_details',
        'penalties_details',
        'leaves_details'
    )
ORDER BY 
    CASE t.table_name
        WHEN 'profiles' THEN 1
        WHEN 'financial_records' THEN 2
        WHEN 'yearly_records' THEN 3
        WHEN 'thanks_details' THEN 4
        WHEN 'committees_details' THEN 5
        WHEN 'penalties_details' THEN 6
        WHEN 'leaves_details' THEN 7
    END,
    c.ordinal_position;
