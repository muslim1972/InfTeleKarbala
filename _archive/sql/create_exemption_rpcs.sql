-- ==============================================================================
-- Migration: Add atomic RPCs for weekly exemptions
-- Kernel: BE-ATT-01
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.save_employee_weekly_exemption(
    p_employee_id UUID,
    p_governorate TEXT,
    p_days INTEGER[],
    p_order_number TEXT,
    p_order_date DATE,
    p_valid_until DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN;
    v_day INTEGER;
    v_count INTEGER := 0;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- Check caller permissions
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id 
          AND (role = 'admin' OR admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr', 'attendance_supervisor'))
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'ليست لديك صلاحية حفظ أو تعديل أوامر التفرغ';
    END IF;

    IF p_employee_id IS NULL THEN
        RAISE EXCEPTION 'يجب تحديد الموظف المعني بالتفرغ';
    END IF;

    IF p_days IS NULL OR array_length(p_days, 1) = 0 THEN
        RAISE EXCEPTION 'يجب تحديد يوم تفرغ واحد على الأقل';
    END IF;

    IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
        RAISE EXCEPTION 'يجب إدخال رقم الأمر الإداري';
    END IF;

    IF p_order_date IS NULL THEN
        RAISE EXCEPTION 'يجب إدخال تاريخ صدور الأمر الإداري';
    END IF;

    IF p_valid_until IS NULL THEN
        RAISE EXCEPTION 'يجب إدخال تاريخ نهاية السريان';
    END IF;

    IF p_valid_until < p_order_date THEN
        RAISE EXCEPTION 'تاريخ نهاية السريان لا يمكن أن يكون قبل تاريخ الأمر الإداري';
    END IF;

    -- Upsert each day
    FOREACH v_day IN ARRAY p_days LOOP
        INSERT INTO public.employee_weekly_exemptions (
            employee_id,
            governorate,
            day_of_week,
            order_number,
            order_date,
            valid_until,
            notes,
            created_by,
            updated_at
        ) VALUES (
            p_employee_id,
            COALESCE(p_governorate, 'karbala'),
            v_day,
            trim(p_order_number),
            p_order_date,
            p_valid_until,
            trim(p_notes),
            v_caller_id,
            now()
        )
        ON CONFLICT (employee_id, day_of_week) DO UPDATE SET
            governorate = EXCLUDED.governorate,
            order_number = EXCLUDED.order_number,
            order_date = EXCLUDED.order_date,
            valid_until = EXCLUDED.valid_until,
            notes = EXCLUDED.notes,
            created_by = EXCLUDED.created_by,
            updated_at = now();
        
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('تم تسجيل وتثبيت أمر التفرغ لـ (%s) يوم بنجاح', v_count),
        'days_count', v_count
    );
END;
$$;

ALTER FUNCTION public.save_employee_weekly_exemption(UUID, TEXT, INTEGER[], TEXT, DATE, DATE, TEXT) OWNER TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.save_employee_weekly_exemption(UUID, TEXT, INTEGER[], TEXT, DATE, DATE, TEXT) TO authenticated, service_role;

-- Delete RPC
CREATE OR REPLACE FUNCTION public.remove_employee_weekly_exemption(p_exemption_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id 
          AND (role = 'admin' OR admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr', 'attendance_supervisor'))
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'ليست لديك صلاحية حذف أوامر التفرغ';
    END IF;

    DELETE FROM public.employee_weekly_exemptions WHERE id = p_exemption_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم حذف أمر التفرغ بنجاح'
    );
END;
$$;

ALTER FUNCTION public.remove_employee_weekly_exemption(UUID) OWNER TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.remove_employee_weekly_exemption(UUID) TO authenticated, service_role;
