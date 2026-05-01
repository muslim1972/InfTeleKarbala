
-- ===========================================
-- تحديث دالة تسجيل الدخول (إصدار 3.0 المحصن)
-- Secure Login Function v3.0
-- ===========================================

BEGIN;

-- 1. التأكد من وجود الدالة السابقة وحذفها لتجنب تضارب التواقيع
DROP FUNCTION IF EXISTS public.get_login_profile(text);
DROP FUNCTION IF EXISTS public.get_login_profile(text, text);

-- 2. إنشاء الدالة مع تحصين أمني عالي
CREATE OR REPLACE FUNCTION public.get_login_profile(p_username text, p_password text)
RETURNS TABLE (
    id uuid,
    job_number text,
    email text,
    real_email text,
    role text,
    full_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER -- مطلوبة للوصول إلى auth.users بشكل آمن
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_job_number text;
    v_real_email text;
    v_role text;
    v_full_name text;
    v_auth_email text;
    v_blocked_until timestamp with time zone;
BEGIN
    -- أ. التحقق من الـ Rate Limiting (منع التخمين)
    --Identifier يمكن أن يكون اسم المستخدم أو IP (هنا نستخدم اسم المستخدم للحماية)
    SELECT blocked_until INTO v_blocked_until FROM public.rate_limits 
    WHERE identifier = p_username AND endpoint = 'login';
    
    IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
        RAISE EXCEPTION 'Too many attempts. Blocked until %', v_blocked_until;
    END IF;

    -- ب. البحث عن المستخدم في جدول profiles بالمطابقة الصارمة
    -- ملاحظة: نستخدم القفل للاسم وكلمة المرور كما طلبت
    SELECT p.id, p.job_number, p.email, p.role, p.full_name
    INTO v_user_id, v_job_number, v_real_email, v_role, v_full_name
    FROM public.profiles p
    WHERE p.username = p_username AND p.password = p_password;

    -- ج. إذا لم يتم العثور على المستخدم
    IF v_user_id IS NULL THEN
        -- تحديث سجل المحاولات الفاشلة
        PERFORM public.update_rate_limit(p_username, 'login', false);
        RETURN; -- سيعيد مصفوفة فارغة تعني اسم مستخدم أو كلمة مرور خطأ
    END IF;

    -- د. جلب الإيميل المولد من جدول auth.users (الذي يمتلكه الجميع)
    SELECT au.email INTO v_auth_email
    FROM auth.users au
    WHERE au.id = v_user_id;

    -- هـ. إذا لم نجد إيميل في Auth (حالة نادرة)، نستخدم النمط الافتراضي كـ fallback
    IF v_auth_email IS NULL THEN
        v_auth_email := 'c' || v_job_number || '@inftele.com';
    END IF;

    -- و. تحديث سجل المحاولات الناجحة (تصفير العداد)
    PERFORM public.update_rate_limit(p_username, 'login', true);

    -- ز. إرجاع البيانات المطلوبة فقط
    RETURN QUERY SELECT 
        v_user_id, 
        v_job_number, 
        v_auth_email, 
        v_real_email, 
        v_role, 
        v_full_name;
END;
$$;

-- 3. حماية الدالة من التنفيذ المباشر غير المصرح به
REVOKE ALL ON FUNCTION public.get_login_profile(text, text) FROM PUBLIC;
-- السماح للزوار (anon) بتنفيذها فقط لأنهم يحتاجونها لتسجيل الدخول
GRANT EXECUTE ON FUNCTION public.get_login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_profile(text, text) TO authenticated;

COMMIT;
