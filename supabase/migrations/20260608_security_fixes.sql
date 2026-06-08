-- 1. إغلاق ثغرة استعراض كل المستخدمين عبر available_profiles
-- سحب صلاحية التنفيذ من الزوار والعامة
REVOKE EXECUTE ON FUNCTION get_available_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_available_profiles() FROM anon;

-- منح الصلاحية فقط للمستخدمين المسجلين (authenticated)
GRANT EXECUTE ON FUNCTION get_available_profiles() TO authenticated;

-- سحب صلاحيات الاستعلام من الـ View لزيادة الأمان
REVOKE ALL ON available_profiles FROM PUBLIC;
REVOKE ALL ON available_profiles FROM anon;
GRANT SELECT ON available_profiles TO authenticated;

-- 2. إنشاء دالة آمنة مخصصة للتحقق من وجود المستخدم (لشاشة تسجيل الدخول)
-- هذه الدالة ترجع True/False فقط ولا تسرب أي معلومات
CREATE OR REPLACE FUNCTION check_user_exists(p_username text, p_governorate text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM profiles
        WHERE governorate = p_governorate
          AND (username = p_username OR job_number = p_username)
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- منح صلاحية استخدام الدالة للزوار (لتشغيلها قبل تسجيل الدخول)
GRANT EXECUTE ON FUNCTION check_user_exists(text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_user_exists(text, text) TO anon;
GRANT EXECUTE ON FUNCTION check_user_exists(text, text) TO authenticated;

-- 3. تفعيل RLS على جداول التدريب الصيفي لمنع الوصول غير المصرح
-- الجداول الدقيقة الخاصة بالتدريب الصيفي في التطبيق:

-- جدول الإعدادات: summer_training_settings
ALTER TABLE summer_training_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON summer_training_settings;
CREATE POLICY "Enable read access for authenticated users only"
ON summer_training_settings FOR SELECT TO authenticated USING (true);

-- جدول الطلاب المتدربين: summer_training_students
ALTER TABLE summer_training_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON summer_training_students;
CREATE POLICY "Enable read access for authenticated users only"
ON summer_training_students FOR SELECT TO authenticated USING (true);

-- جدول النتائج: summer_training_results
ALTER TABLE summer_training_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users only" ON summer_training_results;
CREATE POLICY "Enable read access for authenticated users only"
ON summer_training_results FOR SELECT TO authenticated USING (true);
