-- =============================================
-- دالة RPC آمنة لجلب محاضري دورات الترفيع
-- تعمل بصلاحية SECURITY DEFINER لتجاوز RLS
-- تعرض فقط الحقول غير الحساسة
-- =============================================

CREATE OR REPLACE FUNCTION public.get_promotion_lecturers()
RETURNS TABLE (
    id uuid,
    full_name text,
    job_number text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.id, p.full_name, p.job_number
    FROM profiles p
    WHERE p.can_access_promotion = true
      AND p.is_promotion_lecturer = true
    ORDER BY p.full_name;
$$;

-- منح صلاحية التنفيذ للمستخدمين المُصادقين فقط
REVOKE ALL ON FUNCTION public.get_promotion_lecturers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_promotion_lecturers() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_promotion_lecturers() TO authenticated;
