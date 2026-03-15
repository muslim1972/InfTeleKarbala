-- 🔍 سكربت فحص الأمان الشامل (Database Security Audit Script)
-- الهدف: استخراج خريطة كاملة للأمان الحالي لضمان عدم توقف أي ميزة عند التعديل.

-- 1. فحص حالة الـ RLS لجميع الجداول في السكيما العامة
SELECT 
    relname as table_name, 
    relrowsecurity as rls_enabled, 
    relforcerowsecurity as force_rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relkind = 'r'
ORDER BY relrowsecurity ASC, relname ASC;

-- 2. استخراج جميع السياسات الحالية (Policies) بالتفصيل
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd as operation, -- (SELECT, INSERT, UPDATE, DELETE)
    qual as using_expression, 
    with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. فحص الصلاحيات الممنوحة للأدوار (Grants)
SELECT 
    table_name, 
    privilege_type, 
    grantee
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated');

-- 4. فحص الجداول التي تحتوي على بيانات حساسة (مثل الايميلات، الرواتب، الهواتف)
SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
AND (
    column_name ILIKE '%salary%' OR 
    column_name ILIKE '%phone%' OR 
    column_name ILIKE '%email%' OR 
    column_name ILIKE '%iban%' OR 
    column_name ILIKE '%amount%' OR
    column_name ILIKE '%role%'
)
ORDER BY table_name;
