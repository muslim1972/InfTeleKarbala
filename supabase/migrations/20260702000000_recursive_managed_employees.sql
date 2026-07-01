-- =============================================
-- تحديث الدالة لتجلب الموظفين التابعين بشكل هرمي (Recursive)
-- وتأمينها باستخدام SECURITY DEFINER لتخطي RLS للقراءة فقط من قبل الدالة
-- =============================================

-- Drop the old function if it exists to replace it with the new signature/return type
DROP FUNCTION IF EXISTS public.get_managed_employees(UUID);

CREATE OR REPLACE FUNCTION public.get_managed_employees(p_manager_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    job_number TEXT,
    department_id UUID,
    appointment_date DATE
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH RECURSIVE managed_depts AS (
        -- الأساس: الأقسام التي يديرها الموظف مباشرة
        SELECT d.id
        FROM departments d
        WHERE d.manager_id = p_manager_id
        
        UNION ALL
        
        -- التكرار الهرمي: الأقسام التابعة (الأبناء) للأقسام المُدارة
        SELECT d.id
        FROM departments d
        INNER JOIN managed_depts md ON d.parent_id = md.id
    )
    SELECT 
        p.id, 
        p.full_name, 
        p.job_number, 
        p.department_id, 
        p.appointment_date
    FROM profiles p
    WHERE p.department_id IN (SELECT id FROM managed_depts)
    ORDER BY p.full_name ASC;
$$;
