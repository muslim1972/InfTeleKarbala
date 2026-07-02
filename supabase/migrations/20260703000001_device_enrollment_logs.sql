-- =============================================
-- جدول سجل توثيق الأجهزة (Device Enrollment Logs)
-- يحفظ حركات إضافة وإزالة الأجهزة للموظفين
-- =============================================

CREATE TABLE IF NOT EXISTS public.device_enrollment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('ENROLL', 'UNENROLL')),
    device_name TEXT NOT NULL,
    credential_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للبحث السريع وتصفية السجلات
CREATE INDEX IF NOT EXISTS idx_device_logs_user_id ON public.device_enrollment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_created_at ON public.device_enrollment_logs(created_at DESC);

-- تفعيل RLS
ALTER TABLE public.device_enrollment_logs ENABLE ROW LEVEL SECURITY;

-- المشرف فقط يمكنه قراءة السجلات
CREATE POLICY "Admins can view device enrollment logs"
    ON public.device_enrollment_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.admin_role IN ('developer', 'general', 'hr'))
        )
    );

-- لا يُسمح لأحد بإضافة السجلات يدوياً (الإضافة تتم عبر الـ Trigger فقط) أو الحذف أو التعديل
-- (نظام Supabase افتراضياً يمنع العمليات التي ليس لها سياسة صريحة)

-- =============================================
-- Triggers لتسجيل الإضافة والحذف تلقائياً
-- =============================================

-- 1. دالة الـ Trigger
CREATE OR REPLACE FUNCTION public.log_device_enrollment_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.device_enrollment_logs (user_id, action_type, device_name, credential_id)
        VALUES (NEW.user_id, 'ENROLL', NEW.device_name, NEW.credential_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.device_enrollment_logs (user_id, action_type, device_name, credential_id)
        VALUES (OLD.user_id, 'UNENROLL', OLD.device_name, OLD.credential_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ربط الدالة بجدول webauthn_credentials
DROP TRIGGER IF EXISTS webauthn_credentials_audit_trigger ON public.webauthn_credentials;
CREATE TRIGGER webauthn_credentials_audit_trigger
AFTER INSERT OR DELETE ON public.webauthn_credentials
FOR EACH ROW
EXECUTE FUNCTION public.log_device_enrollment_changes();
