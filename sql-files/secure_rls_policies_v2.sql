-- ===========================================
-- سياسات RLS الآمنة والشاملة (إصدار 2)
-- Comprehensive Secure RLS Policies v2
-- متوافق مع جدول profiles
-- ===========================================

-- 1. إضافة أعمدة مفقودة لجدول profiles إذا لم تكن موجودة
DO $$
BEGIN
  -- إضافة عمود role إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
  
  -- إضافة عمود password_hash إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN password_hash text;
  END IF;
  
  -- إضافة عمود last_login إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_login'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- 2. دالة آمنة للتحقق من صلاحيات المشرف
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- منح صلاحيات التنفيذ للدالة
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. سياسات جدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- المستخدمون يرون ملفاتهم فقط والمشرفون يرون الكل
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

-- المستخدمون يمكنهم إدراج ملفاتهم فقط
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- المستخدمون يمكنهم تحديث ملفاتهم فقط
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());

-- المشرفون فقط يمكنهم الحذف
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (is_admin());

-- 4. سياسات جدول financial_records
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

-- 5. سياسات جدول yearly_records
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

-- 6. سياسات جدول administrative_summary
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

-- 7. منح الصلاحيات الأساسية
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 8. تعيين مشرف افتراضي (استبدل UUID بمعرف المستخدم المشرف)
-- UPDATE public.profiles SET role = 'admin' WHERE job_number = 'ADMIN_JOB_NUMBER';