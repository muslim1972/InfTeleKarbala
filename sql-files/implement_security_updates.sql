-- ===========================================
-- التحسينات الأمنية الإضافية (Activity Logging, Rate Limiting, 2FA)
-- Security Enhancements: Activity Logging, Rate Limiting, 2FA
-- ===========================================

BEGIN;

-- ===========================================
-- 2. جدول تسجيل الأنشطة (Activity Logs)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
    target_table text,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

-- تفعيل RLS على سجل الأنشطة
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- المشرفون فقط يمكنهم القراءة، ولا أحد يمكنه التعديل أو الحذف
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view activity logs" ON public.activity_logs
    FOR SELECT USING (is_admin());

-- السماح للـ Trigger والـ Edge Functions بالإدراج (Bypass RLS or using Service Role)
-- لا نضيف سياسة للإدراج للمستخدمين العاديين من واجهة التطبيق لحمايته من العبث.
-- الإدراج سيتم إما بصلاحيات System (Service Role) أو من خلال Trigger يعمل بـ SECURITY DEFINER.

-- ===========================================
-- 3. Trigger لتسجيل الأنشطة التلقائي (Automatic Audit Trigger)
-- ===========================================
CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- محاولة جلب المستخدم الحالي إذا كان متاحاً في الجلسة (للمصادقة العادية)
    v_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_logs (user_id, action, target_table, details)
        VALUES (v_user_id, 'INSERT', TG_TABLE_NAME, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_logs (user_id, action, target_table, details)
        VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_logs (user_id, action, target_table, details)
        VALUES (v_user_id, 'DELETE', TG_TABLE_NAME, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- تطبيق الـ Trigger على الجداول الهامة
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

DROP TRIGGER IF EXISTS audit_financial_records ON public.financial_records;
CREATE TRIGGER audit_financial_records
    AFTER INSERT OR UPDATE OR DELETE ON public.financial_records
    FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

DROP TRIGGER IF EXISTS audit_leave_requests ON public.leave_requests;
CREATE TRIGGER audit_leave_requests
    AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.log_table_activity();

-- ===========================================
-- 4. جدول Rate Limiting (لمنع محاولات الدخول العشوائية)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    identifier text NOT NULL, -- IP address or Job Number
    endpoint text NOT NULL, -- e.g., 'auth-login'
    attempts int DEFAULT 1,
    last_attempt timestamp with time zone DEFAULT NOW(),
    blocked_until timestamp with time zone,
    CONSTRAINT unique_rate_limit UNIQUE (identifier, endpoint)
);

-- لا حاجة لتفعيل RLS صارم إذا كان التعديل سيتم من الـ Edge Functions (Service Role) فقط
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

COMMIT;

-- تم تنفيذ التحديثات بنجاح.
