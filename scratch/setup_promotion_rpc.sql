-- إنشاء دالة للبحث عن الموظفين لدورات الترفيع (تتجاوز RLS)
CREATE OR REPLACE FUNCTION search_promotion_candidates(search_term TEXT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    job_number TEXT,
    role TEXT,
    is_promotion_lecturer BOOLEAN,
    can_access_promotion BOOLEAN
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        p.id, 
        p.full_name, 
        p.job_number, 
        p.role, 
        p.is_promotion_lecturer, 
        p.can_access_promotion
    FROM profiles p
    WHERE p.full_name ILIKE '%' || search_term || '%' 
       OR p.job_number ILIKE '%' || search_term || '%'
    ORDER BY p.full_name
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- إنشاء دالة لجلب الموظفين المضافين مسبقاً (تتجاوز RLS)
CREATE OR REPLACE FUNCTION get_promotion_users(supervisor_mode BOOLEAN)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    job_number TEXT,
    role TEXT,
    is_promotion_lecturer BOOLEAN,
    can_access_promotion BOOLEAN
) 
SECURITY DEFINER
AS $$
BEGIN
    IF supervisor_mode THEN
        RETURN QUERY 
        SELECT 
            p.id, p.full_name, p.job_number, p.role, p.is_promotion_lecturer, p.can_access_promotion
        FROM profiles p
        WHERE p.is_promotion_lecturer = true
        ORDER BY p.full_name;
    ELSE
        RETURN QUERY 
        SELECT 
            p.id, p.full_name, p.job_number, p.role, p.is_promotion_lecturer, p.can_access_promotion
        FROM profiles p
        WHERE p.can_access_promotion = true AND p.is_promotion_lecturer = false
        ORDER BY p.full_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- إنشاء دالة لتغيير صلاحيات دورات الترفيع (تتجاوز RLS)
CREATE OR REPLACE FUNCTION set_promotion_permission(
    target_user_id UUID, 
    make_supervisor BOOLEAN, 
    make_student BOOLEAN
)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
    -- التحقق من أن المستخدم الحالي لديه صلاحية
    IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND (profiles.admin_role IN ('developer', 'general') OR profiles.is_promotion_lecturer = true)
    ) THEN
        UPDATE profiles 
        SET 
            is_promotion_lecturer = make_supervisor,
            can_access_promotion = make_student
        WHERE profiles.id = target_user_id;
    ELSE
        RAISE EXCEPTION 'Access Denied';
    END IF;
END;
$$ LANGUAGE plpgsql;
