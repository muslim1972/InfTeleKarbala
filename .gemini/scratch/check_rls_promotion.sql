-- 1. فحص سياسات RLS على جدول profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual::text AS using_expression,
    with_check::text AS with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. فحص حالة RLS على الجدول
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname = 'profiles';

-- 3. فحص الأعمدة المتعلقة بالترفيع
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' 
AND column_name IN ('can_access_promotion', 'is_promotion_lecturer', 'promotion_course_type')
ORDER BY column_name;

-- 4. فحص عدد المحاضرين المسجلين
SELECT 
    id, 
    full_name, 
    job_number, 
    can_access_promotion, 
    is_promotion_lecturer
FROM profiles
WHERE can_access_promotion = true
ORDER BY is_promotion_lecturer DESC, full_name;

-- 5. فحص وجود دالة RPC خاصة بالترفيع
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%promotion%'
ORDER BY routine_name;
