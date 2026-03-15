-- 🔍 سكربت فحص أسماء الأعمدة للجداول المستهدفة
SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name IN (
    'five_year_leaves', 
    'leave_history', 
    'leave_trigger_logs', 
    'penalties_details', 
    'poll_responses', 
    'poll_comments',
    'app_users'
)
ORDER BY table_name, column_name;
