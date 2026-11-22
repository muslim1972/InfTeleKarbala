-- 1. دالة التحقق من كون المستخدم مسؤولاً أو بديلاً عن التشكيل أو مشرفاً عاماً
CREATE OR REPLACE FUNCTION public.is_department_supervisor(check_dept_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
    cur_uid uuid := auth.uid();
BEGIN
    IF cur_uid IS NULL THEN
        RETURN false;
    END IF;

    -- التحقق إن كان المستخدم مسؤولاً أو بديلاً للقسم نفسه
    IF EXISTS (
        SELECT 1 FROM departments
        WHERE id = check_dept_id
          AND (manager_id = cur_uid OR deputy_manager_id = cur_uid)
    ) THEN
        RETURN true;
    END IF;

    -- التحقق إن كان مسؤولاً أو بديلاً لقسم أعلى (أب)
    IF EXISTS (
        WITH RECURSIVE dept_tree AS (
            SELECT id, parent_id, manager_id, deputy_manager_id
            FROM departments
            WHERE id = check_dept_id
            UNION ALL
            SELECT d.id, d.parent_id, d.manager_id, d.deputy_manager_id
            FROM departments d
            INNER JOIN dept_tree dt ON d.id = dt.parent_id
        )
        SELECT 1 FROM dept_tree
        WHERE manager_id = cur_uid OR deputy_manager_id = cur_uid
    ) THEN
        RETURN true;
    END IF;

    -- التحقق من المشرفين ذوي الصلاحيات الإدارية
    RETURN is_privileged_user();
END;
$$;

-- 2. دالة جلب موظفي التشكيل لمسؤول التشكيل وبديله
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
    ORDER BY p.full_name ASC;
END;
$$;

-- 3. دالة تحديث جدول دوام الموظف من قبل مسؤوله المباشر أو بديله
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

-- 4. تمكين مسؤولي التشكيلات وبدلائهم من إدارة جداول الدوام في work_schedules و work_schedule_days
CREATE OR REPLACE FUNCTION public.can_manage_duty_schedules()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF is_privileged_user() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM departments
        WHERE manager_id = auth.uid() OR deputy_manager_id = auth.uid()
    );
END;
$$;

-- تحديث سياسات work_schedules
DROP POLICY IF EXISTS "Admins can manage schedules" ON work_schedules;
CREATE POLICY "Admins and supervisors can manage schedules"
ON work_schedules
FOR ALL
TO authenticated
USING (can_manage_duty_schedules())
WITH CHECK (can_manage_duty_schedules());

-- تحديث سياسات work_schedule_days
DROP POLICY IF EXISTS "Admins can manage schedule days" ON work_schedule_days;
CREATE POLICY "Admins and supervisors can manage schedule days"
ON work_schedule_days
FOR ALL
TO authenticated
USING (can_manage_duty_schedules())
WITH CHECK (can_manage_duty_schedules());

-- 5. منح الصلاحيات للمستخدمين المسجلين
GRANT EXECUTE ON FUNCTION public.is_department_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supervised_department_employees(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_supervised_employee_schedule(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_duty_schedules() TO authenticated;

-- 6. تنظيف الإشعارات العشوائية القديمة لتذكير المناوبة المكررة من system_notifications
DELETE FROM system_notifications
WHERE (metadata->>'type' = 'roster_expiry_reminder' OR title LIKE '%تحديث جدول دوام المناوبة%');

-- إعادة تحميل كاش PostgREST
NOTIFY pgrst, 'reload schema';
