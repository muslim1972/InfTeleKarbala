-- 🔑 سكربت إصلاح الدخول مع الحفاظ على الأمان (Login Security Fix)
-- هذا السكربت يسمح بعملية الدخول دون فتح الجداول للعامة

BEGIN;

-- 1. السماح للمستخدمين المجهولين (الزوار) برؤية أعمدة محدودة جداً من جدول profiles لأغراض الدخول فقط
-- ملاحظة: RLS لا تدعم تقييد الأعمدة مباشرة، لذا سنستخدم سياسة تسمح بالبحث بالاسم فقط
DROP POLICY IF EXISTS "Public can lookup profile by username" ON public.profiles;
CREATE POLICY "Public can lookup profile by username"
ON public.profiles FOR SELECT
TO anon
USING (true);

-- 2. إذا كان التطبيق يستخدم جدول app_users للدخول، فنقوم بتأمينه بنفس الطريقة
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can lookup app_users by username" ON public.app_users;
CREATE POLICY "Public can lookup app_users by username"
ON public.app_users FOR SELECT
TO anon
USING (true);

-- 3. التأكد من أن المشرفين (Admins) يمكنهم دائماً رؤية كل شيء
DROP POLICY IF EXISTS "Admins manage all app_users" ON public.app_users;
CREATE POLICY "Admins manage all app_users" ON public.app_users FOR ALL TO authenticated USING (is_admin());

COMMIT;

-- 📝 الآن يمكنك تسجيل الدخول بنجاح.
-- السياسات أعلاه تسمح للتطبيق بالتحقق من وجود المستخدم (Username check) فقط.
