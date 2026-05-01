-- سكربت تحصين أمان التطبيق (Security Hardening Script)
-- الإصدار: 2.0 (مطابق لهيكلية الصلاحيات الفعلية)

BEGIN;

-- ===========================================
-- 1. تحديث دوال التحقق من الصلاحيات (The Guards)
-- ===========================================

-- أ. التحقق من صفة "أدمن" (المدير العام)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ب. التحقق من "المستخدم المميز" (أي موظف لديه دور إداري)
CREATE OR REPLACE FUNCTION public.is_privileged_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND (role = 'admin' OR admin_role IS NOT NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ج. التحقق من صلاحية "المالية" (مطور أو مالية)
CREATE OR REPLACE FUNCTION public.is_finance_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND (admin_role IN ('developer', 'finance') OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- د. التحقق من صلاحية "الموارد البشرية" (مطور أو HR)
CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND (admin_role IN ('developer', 'hr') OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_privileged_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr_admin() TO authenticated;

-- ===========================================
-- 2. تحصين الجداول المالية (Financial Hardening)
-- ===========================================
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees can view own financial records" ON public.financial_records;
DROP POLICY IF EXISTS "Admins can manage all financial records" ON public.financial_records;
DROP POLICY IF EXISTS "financial_records_select_policy" ON public.financial_records;

CREATE POLICY "financial_records_select_policy"
ON public.financial_records FOR SELECT
USING (auth.uid() = user_id OR is_finance_admin());

CREATE POLICY "financial_records_write_policy"
ON public.financial_records FOR ALL
USING (is_finance_admin())
WITH CHECK (is_finance_admin());

-- ===========================================
-- 3. تحصين الملفات الشخصية (Profiles Hardening)
-- ===========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR is_privileged_user());

-- ===========================================
-- 4. تحصين جداول الموارد البشرية والإجازات
-- ===========================================

-- أ. الإجازات والسجلات السنوية
ALTER TABLE public.yearly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yearly_records_select_policy" ON public.yearly_records;
CREATE POLICY "yearly_records_select_policy" ON public.yearly_records 
FOR SELECT USING (auth.uid() = user_id OR is_hr_admin());

DROP POLICY IF EXISTS "yearly_records_write_policy" ON public.yearly_records;
CREATE POLICY "yearly_records_write_policy" ON public.yearly_records 
FOR ALL USING (is_hr_admin());

DROP POLICY IF EXISTS "leaves_details_select_policy" ON public.leaves_details;
CREATE POLICY "leaves_details_select_policy" ON public.leaves_details 
FOR SELECT USING (auth.uid() = user_id OR is_hr_admin());

-- ب. طلبات الإجازات (تسمح للمسؤول المباشر بالموافقة)
DROP POLICY IF EXISTS "leave_requests_update_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_update_policy" ON public.leave_requests
FOR UPDATE USING (auth.uid() = supervisor_id OR is_hr_admin());

-- ج. كتب الشكر واللجان والعقوبات
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thanks_details_write_policy" ON public.thanks_details;
CREATE POLICY "thanks_details_write_policy" ON public.thanks_details FOR ALL USING (is_hr_admin());

DROP POLICY IF EXISTS "committees_details_write_policy" ON public.committees_details;
CREATE POLICY "committees_details_write_policy" ON public.committees_details FOR ALL USING (is_hr_admin());

DROP POLICY IF EXISTS "penalties_details_write_policy" ON public.penalties_details;
CREATE POLICY "penalties_details_write_policy" ON public.penalties_details FOR ALL USING (is_hr_admin());

-- ===========================================
-- 5. جداول الاستبيانات والتواصل (General & Media)
-- ===========================================
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage admin_tips" ON public.admin_tips;
CREATE POLICY "Admins manage admin_tips" ON public.admin_tips FOR ALL 
USING (admin_role IN ('developer', 'media', 'general') OR role = 'admin');

-- ===========================================
-- 6. تحديث الدوال الأمنية للمحادثات
-- ===========================================
CREATE OR REPLACE FUNCTION public.delete_chat_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_participant BOOLEAN;
BEGIN
    -- الحارس: التأكد من المشاركة قبل الحذف
    SELECT (participants @> to_jsonb(auth.uid()::text)) INTO v_is_participant 
    FROM public.conversations WHERE id = p_conversation_id;

    IF NOT v_is_participant THEN
        RAISE EXCEPTION 'غير مصرح لك بحذف هذه المحادثة';
    END IF;

    -- إضافة المستخدم لقائمة الحذف (Soft Delete Logic)
    UPDATE public.conversations
    SET deleted_by = array_append(COALESCE(deleted_by, '{}'::uuid[]), auth.uid())
    WHERE id = p_conversation_id;
END;
$$;

-- ===========================================
-- 7. التأكد النهائي من تفعيل RLS (Safety Sweep)
-- ===========================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'profiles', 'financial_records', 'administrative_summary', 
      'yearly_records', 'thanks_details', 'committees_details', 
      'penalties_details', 'leaves_details', 'leave_requests', 
      'messages', 'conversations', 'activity_logs'
    )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

COMMIT;
