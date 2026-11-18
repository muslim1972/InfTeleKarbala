-- ==============================================================================
-- Migration: 20261118000000_att01_work_schedules_exemptions_and_special.sql
-- Kernel: BE-ATT-01
-- Purpose: Add weekly day exemptions and employee-specific special work schedules
-- ==============================================================================

-- 1. Extend work_schedules to support special schedules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_schedules' AND column_name = 'employee_id'
    ) THEN
        ALTER TABLE public.work_schedules 
        ADD COLUMN employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_schedules' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.work_schedules 
        ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Update constraint to allow 'special'
ALTER TABLE public.work_schedules DROP CONSTRAINT IF EXISTS work_schedules_type_check;
ALTER TABLE public.work_schedules ADD CONSTRAINT work_schedules_type_check 
CHECK (type = ANY (ARRAY['fixed'::text, 'flexible'::text, 'roster'::text, 'special'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_schedules_employee_special 
ON public.work_schedules(employee_id) 
WHERE type = 'special';

-- 2. Create employee_weekly_exemptions table
CREATE TABLE IF NOT EXISTS public.employee_weekly_exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    governorate TEXT NOT NULL DEFAULT 'karbala',
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    order_number TEXT NOT NULL,
    order_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_employee_exemption_day UNIQUE (employee_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_employee_exemptions_lookup 
ON public.employee_weekly_exemptions(employee_id, day_of_week, valid_until);

ALTER TABLE public.employee_weekly_exemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read exemptions" ON public.employee_weekly_exemptions;
CREATE POLICY "Everyone can read exemptions" 
ON public.employee_weekly_exemptions 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can manage exemptions" ON public.employee_weekly_exemptions;
CREATE POLICY "Admins can manage exemptions" 
ON public.employee_weekly_exemptions 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
          AND (profiles.role = 'admin' OR profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr', 'attendance_supervisor'))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
          AND (profiles.role = 'admin' OR profiles.admin_role IN ('developer', 'general', 'biometric', 'hr_supervisor', 'hr', 'attendance_supervisor'))
    )
);

-- 3. Atomic RPC to remove special schedule and revert to default
CREATE OR REPLACE FUNCTION public.remove_employee_special_schedule(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_default_schedule_id UUID;
    v_special_schedule_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- Get default schedule
    SELECT id INTO v_default_schedule_id
    FROM public.work_schedules
    WHERE is_default = true
    LIMIT 1;

    -- Get employee's special schedule
    SELECT id INTO v_special_schedule_id
    FROM public.work_schedules
    WHERE employee_id = p_employee_id AND type = 'special'
    LIMIT 1;

    -- Revert profile work_schedule_id to default
    UPDATE public.profiles
    SET work_schedule_id = v_default_schedule_id
    WHERE id = p_employee_id;

    -- Delete special schedule if exists
    IF v_special_schedule_id IS NOT NULL THEN
        DELETE FROM public.work_schedules WHERE id = v_special_schedule_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'تم حذف الدوام الخاص وإعادة الموظف إلى الدوام الصباحي الافتراضي بنجاح'
    );
END;
$$;

ALTER FUNCTION public.remove_employee_special_schedule(UUID) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.remove_employee_special_schedule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_employee_special_schedule(UUID) TO authenticated, service_role;

-- 4. Atomic RPC to save or update employee special schedule
CREATE OR REPLACE FUNCTION public.save_employee_special_schedule(
    p_employee_id UUID,
    p_days JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_name TEXT;
    v_schedule_id UUID;
    v_day JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_employee_id;
    IF v_user_name IS NULL THEN
        RAISE EXCEPTION 'الموظف غير موجود';
    END IF;

    -- Find existing special schedule
    SELECT id INTO v_schedule_id
    FROM public.work_schedules
    WHERE employee_id = p_employee_id AND type = 'special'
    LIMIT 1;

    IF v_schedule_id IS NULL THEN
        INSERT INTO public.work_schedules (
            name,
            type,
            is_default,
            grace_period_minutes,
            employee_id,
            created_by
        ) VALUES (
            'دوام خاص - ' || v_user_name,
            'special',
            false,
            15,
            p_employee_id,
            auth.uid()
        ) RETURNING id INTO v_schedule_id;
    ELSE
        UPDATE public.work_schedules
        SET name = 'دوام خاص - ' || v_user_name,
            updated_at = now()
        WHERE id = v_schedule_id;

        DELETE FROM public.work_schedule_days WHERE schedule_id = v_schedule_id;
    END IF;

    -- Insert daily hours
    FOR v_day IN SELECT * FROM jsonb_array_elements(p_days)
    LOOP
        INSERT INTO public.work_schedule_days (
            schedule_id,
            day_of_week,
            is_rest_day,
            start_time,
            end_time
        ) VALUES (
            v_schedule_id,
            (v_day->>'day_of_week')::INTEGER,
            COALESCE((v_day->>'is_rest_day')::BOOLEAN, false),
            CASE WHEN COALESCE((v_day->>'is_rest_day')::BOOLEAN, false) THEN NULL ELSE (v_day->>'start_time')::TIME END,
            CASE WHEN COALESCE((v_day->>'is_rest_day')::BOOLEAN, false) THEN NULL ELSE (v_day->>'end_time')::TIME END
        );
    END LOOP;

    -- Link employee profile
    UPDATE public.profiles
    SET work_schedule_id = v_schedule_id
    WHERE id = p_employee_id;

    RETURN jsonb_build_object(
        'success', true, 
        'schedule_id', v_schedule_id, 
        'message', 'تم حفظ وتثبيت الدوام الخاص للموظف بنجاح'
    );
END;
$$;

ALTER FUNCTION public.save_employee_special_schedule(UUID, JSONB) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.save_employee_special_schedule(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_employee_special_schedule(UUID, JSONB) TO authenticated, service_role;

-- Table permissions
GRANT ALL ON TABLE public.employee_weekly_exemptions TO authenticated, service_role;
GRANT SELECT ON TABLE public.employee_weekly_exemptions TO anon;

-- 5. Atomic RPC to save employee weekly exemptions
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

-- 6. Atomic RPC to remove employee weekly exemption
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
