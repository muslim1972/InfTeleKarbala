-- إصلاح دالة core_resolve_approval_chain وإزالة التضارب في أسماء الأعمدة (ambiguous manager_id)
CREATE OR REPLACE FUNCTION public.core_resolve_approval_chain(p_user_id UUID)
RETURNS TABLE (
    manager_id UUID,
    manager_name TEXT,
    dept_id UUID,
    dept_name TEXT,
    dept_level INTEGER,
    step_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_dept_id UUID;
    v_curr_dept_id UUID;
    v_gov TEXT;
    v_visited UUID[] := '{}';
    v_step INTEGER := 1;
    v_mgr_id UUID;
    v_mgr_name TEXT;
    v_parent_id UUID;
    v_lvl INTEGER;
    v_dname TEXT;
    v_is_top_self BOOLEAN := FALSE;
BEGIN
    -- جلب قسم ومحافظة الموظف
    SELECT p.department_id, p.governorate INTO v_dept_id, v_gov
    FROM public.profiles p WHERE p.id = p_user_id;

    IF v_dept_id IS NULL THEN
        RETURN;
    END IF;

    v_curr_dept_id := v_dept_id;

    WHILE v_curr_dept_id IS NOT NULL AND NOT (v_curr_dept_id = ANY(v_visited)) LOOP
        v_visited := array_append(v_visited, v_curr_dept_id);

        SELECT d.id, d.name, d.manager_id, d.parent_id, d.level
        INTO v_curr_dept_id, v_dname, v_mgr_id, v_parent_id, v_lvl
        FROM public.departments d
        WHERE d.id = v_curr_dept_id;

        IF NOT FOUND THEN
            EXIT;
        END IF;

        -- إذا كان المسؤول موجوداً وليس هو الموظف صاحب الطلب
        IF v_mgr_id IS NOT NULL AND v_mgr_id <> p_user_id THEN
            SELECT p.full_name INTO v_mgr_name FROM public.profiles p WHERE p.id = v_mgr_id;
            
            manager_id := v_mgr_id;
            manager_name := COALESCE(v_mgr_name, 'مسؤول');
            dept_id := v_curr_dept_id;
            dept_name := v_dname;
            dept_level := v_lvl;
            step_order := v_step;
            
            RETURN NEXT;
            v_step := v_step + 1;

        ELSIF v_mgr_id = p_user_id AND v_parent_id IS NULL THEN
            -- رأس الهرم (مدير المديرية ليس له أب) NTF-R08
            v_is_top_self := TRUE;
        END IF;

        -- التوقف عند بلوغ مستوى مدير القسم (level <= 3) شرط ألا يكون صاحب الطلب هو مدير القسم
        IF v_lvl <= 3 AND v_mgr_id <> p_user_id THEN
            EXIT;
        END IF;

        v_curr_dept_id := v_parent_id;
    END LOOP;

    -- إذا كان الموظف هو رأس الهرم بذاته ولم يضف أي مسؤول
    IF v_is_top_self AND v_step = 1 THEN
        SELECT p.full_name INTO v_mgr_name FROM public.profiles p WHERE p.id = p_user_id;
        manager_id := p_user_id;
        manager_name := COALESCE(v_mgr_name, 'المدير العام');
        dept_id := v_dept_id;
        dept_name := 'الإدارة العليا';
        dept_level := 1;
        step_order := 1;
        RETURN NEXT;
    END IF;

    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.core_resolve_approval_chain(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_resolve_approval_chain(UUID) TO authenticated;
