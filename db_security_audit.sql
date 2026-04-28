-- ==========================================
-- سكربت الفحص الأمني الشامل لقاعدة البيانات
-- Comprehensive Database Security Audit Script
-- ==========================================

-- 1. فحص حالة RLS على جميع الجداول (التي تم ذكرها في الخطط الأمنية)
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as "RLS Enabled?"
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. عرض جميع سياسات الوصول (Policies) وتفاصيلها (يساعد في تقييم مدى صرامتها)
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd as "Operation", 
    qual as "Using Clause", 
    with_check as "With Check Clause"
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 3. فحص وجود تشفير كلمات المرور (أعمدة ودوال)
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'app_users' AND column_name IN ('password_hash', 'password');

SELECT 
    proname as "Function Name", 
    prosecdef as "Is Security Definer?" 
FROM pg_proc 
WHERE proname IN ('hash_password', 'verify_password', 'authenticate_user');

-- 4. فحص الجداول والأعمدة الخاصة بالمصادقة الثنائية 2FA
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'app_users' AND column_name LIKE '%two_factor%';

-- 5. فحص وجود جدول تسجيل الأنشطة (Activity Logging)
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'activity_logs';

-- 6. فحص الـ Triggers المتعلقة بتسجيل الأنشطة
SELECT 
    event_object_table as "Table",
    trigger_name as "Trigger Name",
    event_manipulation as "Event"
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name LIKE '%log%';
