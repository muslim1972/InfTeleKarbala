-- ====================================================================
-- Migration: Secure Attendance Records & Enable RLS on Unprotected Tables
-- Date: 2026-09-04
-- Target: ITPC Karbala Production DB
-- ====================================================================

BEGIN;

-- 1. Create the secure RPC function for recording / updating attendance
CREATE OR REPLACE FUNCTION public.submit_attendance_record_secure(
    p_employee_id UUID,
    p_record_id UUID DEFAULT NULL,
    p_updates JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_privileged BOOLEAN := false;
    v_result JSONB;
    v_existing_record RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_caller_id := auth.uid();
    
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول (Authentication required)';
    END IF;

    -- Check if caller is privileged (admin / general / developer / hr_manager)
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_id 
        AND (
            role IN ('admin', 'hr_manager') 
            OR admin_role IN ('general', 'developer')
        )
    ) INTO v_is_privileged;

    -- If caller is not privileged, they can ONLY submit/update for themselves
    IF NOT v_is_privileged AND v_caller_id <> p_employee_id THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك تعديل أو تسجيل حضور لموظف آخر';
    END IF;

    -- If record_id is provided, verify it exists and belongs to this employee
    IF p_record_id IS NOT NULL THEN
        SELECT * INTO v_existing_record 
        FROM public.attendance_records 
        WHERE id = p_record_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'سجل الحضور غير موجود';
        END IF;

        IF NOT v_is_privileged AND v_existing_record.employee_id <> v_caller_id THEN
            RAISE EXCEPTION 'غير مصرح: هذا السجل لا يخصك';
        END IF;

        -- UPDATE existing record safely
        UPDATE public.attendance_records
        SET 
            check_in = CASE 
                WHEN p_updates ? 'check_in' THEN (p_updates->>'check_in')::timestamptz 
                ELSE check_in 
            END,
            check_out = CASE 
                WHEN p_updates ? 'check_out' THEN (p_updates->>'check_out')::timestamptz 
                ELSE check_out 
            END,
            check_in_location = CASE 
                WHEN p_updates ? 'check_in_location' THEN p_updates->>'check_in_location' 
                ELSE check_in_location 
            END,
            check_out_location = CASE 
                WHEN p_updates ? 'check_out_location' THEN p_updates->>'check_out_location' 
                ELSE check_out_location 
            END,
            check_in_verified_by_biometric = CASE 
                WHEN p_updates ? 'check_in_verified_by_biometric' THEN (p_updates->>'check_in_verified_by_biometric')::boolean 
                ELSE check_in_verified_by_biometric 
            END,
            check_out_verified_by_biometric = CASE 
                WHEN p_updates ? 'check_out_verified_by_biometric' THEN (p_updates->>'check_out_verified_by_biometric')::boolean 
                ELSE check_out_verified_by_biometric 
            END,
            check_in_device_id = CASE 
                WHEN p_updates ? 'check_in_device_id' THEN p_updates->>'check_in_device_id' 
                ELSE check_in_device_id 
            END,
            check_out_device_id = CASE 
                WHEN p_updates ? 'check_out_device_id' THEN p_updates->>'check_out_device_id' 
                ELSE check_out_device_id 
            END,
            check_in_snapshot_url = CASE 
                WHEN p_updates ? 'check_in_snapshot_url' THEN p_updates->>'check_in_snapshot_url' 
                ELSE check_in_snapshot_url 
            END,
            check_out_snapshot_url = CASE 
                WHEN p_updates ? 'check_out_snapshot_url' THEN p_updates->>'check_out_snapshot_url' 
                ELSE check_out_snapshot_url 
            END,
            time_leave_out = CASE 
                WHEN p_updates ? 'time_leave_out' THEN (p_updates->>'time_leave_out')::timestamptz 
                ELSE time_leave_out 
            END,
            time_leave_return = CASE 
                WHEN p_updates ? 'time_leave_return' THEN (p_updates->>'time_leave_return')::timestamptz 
                ELSE time_leave_return 
            END,
            time_leave_out_2 = CASE 
                WHEN p_updates ? 'time_leave_out_2' THEN (p_updates->>'time_leave_out_2')::timestamptz 
                ELSE time_leave_out_2 
            END,
            time_leave_return_2 = CASE 
                WHEN p_updates ? 'time_leave_return_2' THEN (p_updates->>'time_leave_return_2')::timestamptz 
                ELSE time_leave_return_2 
            END,
            notes = CASE 
                WHEN p_updates ? 'notes' THEN p_updates->>'notes' 
                ELSE notes 
            END,
            admin_notes = CASE 
                WHEN p_updates ? 'admin_notes' THEN p_updates->>'admin_notes' 
                ELSE admin_notes 
            END,
            status = CASE 
                WHEN p_updates ? 'status' THEN p_updates->>'status' 
                ELSE status 
            END,
            is_device_pending = CASE 
                WHEN p_updates ? 'is_device_pending' THEN (p_updates->>'is_device_pending')::boolean 
                ELSE is_device_pending 
            END,
            raw_punches = CASE 
                WHEN p_updates ? 'raw_punches' THEN p_updates->'raw_punches' 
                ELSE raw_punches 
            END,
            overtime_minutes = CASE 
                WHEN p_updates ? 'overtime_minutes' THEN (p_updates->>'overtime_minutes')::integer 
                ELSE overtime_minutes 
            END,
            updated_at = v_now
        WHERE id = p_record_id
        RETURNING to_jsonb(attendance_records.*) INTO v_result;

    ELSE
        -- INSERT new record
        INSERT INTO public.attendance_records (
            employee_id,
            department_id,
            work_schedule_id,
            check_in,
            check_out,
            check_in_location,
            check_out_location,
            check_in_verified_by_biometric,
            check_out_verified_by_biometric,
            check_in_device_id,
            check_out_device_id,
            check_in_snapshot_url,
            check_out_snapshot_url,
            time_leave_out,
            time_leave_return,
            time_leave_out_2,
            time_leave_return_2,
            notes,
            status,
            is_device_pending,
            raw_punches,
            overtime_minutes,
            created_at,
            updated_at
        ) VALUES (
            p_employee_id,
            NULLIF(p_updates->>'department_id', '')::uuid,
            NULLIF(p_updates->>'work_schedule_id', '')::uuid,
            (p_updates->>'check_in')::timestamptz,
            (p_updates->>'check_out')::timestamptz,
            p_updates->>'check_in_location',
            p_updates->>'check_out_location',
            COALESCE((p_updates->>'check_in_verified_by_biometric')::boolean, false),
            COALESCE((p_updates->>'check_out_verified_by_biometric')::boolean, false),
            p_updates->>'check_in_device_id',
            p_updates->>'check_out_device_id',
            p_updates->>'check_in_snapshot_url',
            p_updates->>'check_out_snapshot_url',
            (p_updates->>'time_leave_out')::timestamptz,
            (p_updates->>'time_leave_return')::timestamptz,
            (p_updates->>'time_leave_out_2')::timestamptz,
            (p_updates->>'time_leave_return_2')::timestamptz,
            p_updates->>'notes',
            COALESCE(p_updates->>'status', 'present'),
            COALESCE((p_updates->>'is_device_pending')::boolean, false),
            COALESCE(p_updates->'raw_punches', '[]'::jsonb),
            COALESCE((p_updates->>'overtime_minutes')::integer, 0),
            v_now,
            v_now
        )
        RETURNING to_jsonb(attendance_records.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

-- 2. Drop direct client manipulation policies on attendance_records
DROP POLICY IF EXISTS "Employees can create their own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Employees can update their own attendance" ON public.attendance_records;

-- 3. Ensure attendance_settings is protected by RLS
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read attendance_settings for everyone" ON public.attendance_settings;
CREATE POLICY "Allow read attendance_settings for everyone"
ON public.attendance_settings FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow admins to manage attendance_settings" ON public.attendance_settings;
CREATE POLICY "Allow admins to manage attendance_settings"
ON public.attendance_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.admin_role IN ('general', 'developer'))
    )
);

-- 4. Ensure official_holidays is protected by RLS
ALTER TABLE public.official_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read official_holidays for everyone" ON public.official_holidays;
CREATE POLICY "Allow read official_holidays for everyone"
ON public.official_holidays FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow admins to manage official_holidays" ON public.official_holidays;
CREATE POLICY "Allow admins to manage official_holidays"
ON public.official_holidays FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.admin_role IN ('general', 'developer'))
    )
);

COMMIT;
