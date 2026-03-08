-- سكربت لمعرفة معلومات شاملة عن قاعدة البيانات في Supabase
-- قم بنسخ هذا السكربت ولصقه في محرر SQL (SQL Editor) داخل لوحة تحكم Supabase واضغط على Run

-- 1. عرض جميع الجداول في قاعدة البيانات مع عدد الصفوف التقريبي وحجم كل جدول
SELECT
    relname AS "Table Name",
    n_live_tup AS "Estimated Rows",
    pg_size_pretty(pg_total_relation_size(relid)) AS "Total Size"
FROM
    pg_stat_user_tables
ORDER BY
    n_live_tup DESC;

-- 2. عرض تفاصيل كل الأعمدة (Columns) لجدول معين (كمثال جدول profiles أو messages)
-- لمعرفة تفاصيل الجداول، هذا الاستعلام يجلب جميع الأعمدة وأنواع بياناتها للجداول العامة (public)
SELECT 
    table_name as "Table", 
    column_name as "Column", 
    data_type as "Data Type",
    is_nullable as "Nullable?",
    column_default as "Default Value"
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name, ordinal_position;

-- 3. عرض جميع العلاقات (Foreign Keys) بين الجداول
SELECT
    tc.table_name AS "Table",
    kcu.column_name AS "Column",
    ccu.table_name AS "References Table",
    ccu.column_name AS "References Column"
FROM
    information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY';
