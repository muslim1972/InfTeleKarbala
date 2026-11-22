-- تعديل دالة جلب موظفي التشكيل لاستثناء المسؤول/البديل صاحب الحساب نفسه حتمياً
CREATE OR REPLACE FUNCTION public.get_supervised_department_employees(p_department_id uuid)
RETURNS TABLE (
    id uuid,
    full_name text,
    job_number text,
    work_schedule_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- التحقق من صلاحية الاستعلام
    IF NOT is_department_supervisor(p_department_id) THEN
        RAISE EXCEPTION 'ليس لديك صلاحية استعراض موظفي هذا التشكيل';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.job_number,
        p.work_schedule_id
    FROM profiles p
    WHERE p.department_id = p_department_id
      AND (auth.uid() IS NULL OR p.id != auth.uid()) -- استبعاد المسؤول صاحب الجلسة
    ORDER BY p.full_name ASC;
END;
$$;

-- حظر قيام المسؤول بتعديل دوام نفسه من واجهة الإشراف
CREATE OR REPLACE FUNCTION public.update_supervised_employee_schedule(
    p_employee_id uuid,
    p_schedule_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    emp_dept_id uuid;
BEGIN
    IF auth.uid() IS NOT NULL AND p_employee_id = auth.uid() THEN
        RAISE EXCEPTION 'لا يمكنك تعديل جدول دوامك الشخصي؛ جدولك يُحدد من قبل مسؤولك المباشر للأعلى';
    END IF;

    SELECT department_id INTO emp_dept_id
    FROM profiles
    WHERE id = p_employee_id;

    IF emp_dept_id IS NULL THEN
        RAISE EXCEPTION 'الموظف غير مرتبط بأي تشكيل إداري';
    END IF;

    IF NOT is_department_supervisor(emp_dept_id) THEN
        RAISE EXCEPTION 'ليس لديك صلاحية تعديل جدول دوام هذا الموظف';
    END IF;

    UPDATE profiles
    SET work_schedule_id = p_schedule_id
    WHERE id = p_employee_id;

    RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
