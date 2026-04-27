-- ===========================================
-- سياسات RLS الآمنة والشاملة
-- Comprehensive Secure RLS Policies
-- ===========================================

-- 1. دالة آمنة للتحقق من صلاحيات المشرف
-- SECURE: Uses SECURITY DEFINER with minimal privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- منح صلاحيات التنفيذ للدالة
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. دالة للتحقق من ملكية السجل
CREATE OR REPLACE FUNCTION public.is_own_record(record_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN auth.uid() = record_user_id;
END;
$$;

-- 3. سياسات الجداول الرئيسية

-- ===========================================
-- profiles table
-- ===========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- المستخدمون يمكنهم رؤية ملفاتهم فقط والمشرفون يرون الكل
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- المستخدمون يمكنهم إدراج ملفاتهم فقط
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- المستخدمون يمكنهم تحديث ملفاتهم فقط
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- المشرفون فقط يمكنهم الحذف
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (is_admin());

-- ===========================================
-- financial_records table
-- ===========================================
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own financial records." ON public.financial_records;

CREATE POLICY "financial_records_select_policy" ON public.financial_records
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "financial_records_insert_policy" ON public.financial_records
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "financial_records_update_policy" ON public.financial_records
  FOR UPDATE USING (is_admin());

CREATE POLICY "financial_records_delete_policy" ON public.financial_records
  FOR DELETE USING (is_admin());

-- ===========================================
-- yearly_records table
-- ===========================================
ALTER TABLE public.yearly_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own yearly records." ON public.yearly_records;

CREATE POLICY "yearly_records_select_policy" ON public.yearly_records
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "yearly_records_insert_policy" ON public.yearly_records
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "yearly_records_update_policy" ON public.yearly_records
  FOR UPDATE USING (is_admin());

CREATE POLICY "yearly_records_delete_policy" ON public.yearly_records
  FOR DELETE USING (is_admin());

-- ===========================================
-- administrative_summary table
-- ===========================================
ALTER TABLE public.administrative_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own admin summary." ON public.administrative_summary;

CREATE POLICY "administrative_summary_select_policy" ON public.administrative_summary
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "administrative_summary_insert_policy" ON public.administrative_summary
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "administrative_summary_update_policy" ON public.administrative_summary
  FOR UPDATE USING (is_admin());

CREATE POLICY "administrative_summary_delete_policy" ON public.administrative_summary
  FOR DELETE USING (is_admin());

-- ===========================================
-- thanks_details table
-- ===========================================
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own thanks details" ON public.thanks_details;
DROP POLICY IF EXISTS "Admins can manage thanks details" ON public.thanks_details;

CREATE POLICY "thanks_details_select_policy" ON public.thanks_details
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "thanks_details_insert_policy" ON public.thanks_details
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "thanks_details_update_policy" ON public.thanks_details
  FOR UPDATE USING (is_admin());

CREATE POLICY "thanks_details_delete_policy" ON public.thanks_details
  FOR DELETE USING (is_admin());

-- ===========================================
-- committees_details table
-- ===========================================
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own committees details" ON public.committees_details;
DROP POLICY IF EXISTS "Admins can manage committees details" ON public.committees_details;

CREATE POLICY "committees_details_select_policy" ON public.committees_details
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "committees_details_insert_policy" ON public.committees_details
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "committees_details_update_policy" ON public.committees_details
  FOR UPDATE USING (is_admin());

CREATE POLICY "committees_details_delete_policy" ON public.committees_details
  FOR DELETE USING (is_admin());

-- ===========================================
-- penalties_details table
-- ===========================================
ALTER TABLE public.penalties_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own penalties details" ON public.penalties_details;
DROP POLICY IF EXISTS "Admins can manage penalties details" ON public.penalties_details;

CREATE POLICY "penalties_details_select_policy" ON public.penalties_details
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "penalties_details_insert_policy" ON public.penalties_details
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "penalties_details_update_policy" ON public.penalties_details
  FOR UPDATE USING (is_admin());

CREATE POLICY "penalties_details_delete_policy" ON public.penalties_details
  FOR DELETE USING (is_admin());

-- ===========================================
-- leaves_details table
-- ===========================================
ALTER TABLE public.leaves_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leaves details" ON public.leaves_details;
DROP POLICY IF EXISTS "Admins can manage leaves details" ON public.leaves_details;

CREATE POLICY "leaves_details_select_policy" ON public.leaves_details
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "leaves_details_insert_policy" ON public.leaves_details
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "leaves_details_update_policy" ON public.leaves_details
  FOR UPDATE USING (is_admin());

CREATE POLICY "leaves_details_delete_policy" ON public.leaves_details
  FOR DELETE USING (is_admin());

-- ===========================================
-- leave_requests table
-- ===========================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- المستخدمون يرون طلباتهم، المشرفون يرون الكل
CREATE POLICY "leave_requests_select_policy" ON public.leave_requests
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- المستخدمون يمكنهم إنشاء طلبات
CREATE POLICY "leave_requests_insert_policy" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- فقط المشرفون يمكنهم التحديث (للموافقة/الرفض)
CREATE POLICY "leave_requests_update_policy" ON public.leave_requests
  FOR UPDATE USING (is_admin());

-- المستخدمون يمكنهم حذف طلباتهم المعلقة فقط
CREATE POLICY "leave_requests_delete_policy" ON public.leave_requests
  FOR DELETE USING (
    (auth.uid() = user_id AND status = 'pending') OR is_admin()
  );

-- ===========================================
-- app_users table
-- ===========================================
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- المستخدمون يرون بياناتهم فقط
CREATE POLICY "app_users_select_policy" ON public.app_users
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- لا يمكن إدراج إلا للمشرفين
CREATE POLICY "app_users_insert_policy" ON public.app_users
  FOR INSERT WITH CHECK (is_admin());

-- المستخدمون يمكنهم تحديث بعض بياناتهم
CREATE POLICY "app_users_update_policy" ON public.app_users
  FOR UPDATE USING (auth.uid() = id OR is_admin());

-- فقط المشرفون يمكنهم الحذف
CREATE POLICY "app_users_delete_policy" ON public.app_users
  FOR DELETE USING (is_admin());

-- ===========================================
-- messages table
-- ===========================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- المرسل والمستقبل والمشرف يرون الرسائل
CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR 
    is_admin()
  );

-- المستخدمون يمكنهم إرسال رسائل
CREATE POLICY "messages_insert_policy" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ===========================================
-- 4. منح الصلاحيات الأساسية
-- ===========================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ===========================================
-- 5. تدقيق الأمان
-- ===========================================
-- التأكد من تفعيل RLS على جميع الجداول
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;