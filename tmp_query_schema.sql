-- استخدم محرر SQL في Supabase لتنفيذ هذا الاستعلام
-- الهدف: معرفة تفاصيل بنية جدول السجلات المالية وتحديدا الأعمدة المتعلقة بإجازة الـ 5 سنوات والمخصصات

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'financial_records'
ORDER BY ordinal_position;
