-- ====================================================================
-- Migration: Enforce Server-Time Security on Attendance Records
-- Date: 2026-09-09
-- Purpose: Prevent device clock tampering (phones & PCs with manual time)
--          and enforce server time (NTP / now()) as authoritative.
-- ====================================================================

BEGIN;

-- 1. Create dedicated fast RPC function to provide official server time
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'server_time', clock_timestamp(),
    'server_time_utc', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'baghdad_time', to_char(clock_timestamp() AT TIME ZONE 'Asia/Baghdad', 'YYYY-MM-DD HH24:MI:SS'),
    'baghdad_date', to_char(clock_timestamp() AT TIME ZONE 'Asia/Baghdad', 'YYYY-MM-DD')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated, service_role;

-- 2. Update submit_attendance_record_secure to enforce server time for non-privileged users
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
    v_now TIMESTAMPTZ := clock_timestamp();
    v_today_baghdad DATE := (clock_timestamp() AT TIME ZONE 'Asia/Baghdad')::date;
    v_raw_punches JSONB;
    v_last_punch JSONB;
    v_punch_count INT;
    v_client_time TIMESTAMPTZ;
    v_time_drift_seconds NUMERIC;
    v_security_note TEXT := '';
    v_sanitized_updates JSONB := p_updates;
    v_now_utc_str TEXT := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
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

    -- ====================================================================
    -- ENFORCE SERVER-TIME SECURITY FOR REGULAR EMPLOYEES
    -- ====================================================================
    IF NOT v_is_privileged THEN
        -- A. Verify that existing record belongs to today (Baghdad timezone)
        IF p_record_id IS NOT NULL THEN
            SELECT * INTO v_existing_record 
            FROM public.attendance_records 
            WHERE id = p_record_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'سجل الحضور غير موجود';
            END IF;

            IF v_existing_record.employee_id <> v_caller_id THEN
                RAISE EXCEPTION 'غير مصرح: هذا السجل لا يخصك';
            END IF;

            IF (v_existing_record.created_at AT TIME ZONE 'Asia/Baghdad')::date <> v_today_baghdad THEN
                RAISE EXCEPTION 'غير مصرح: لا يمكن تعديل أو إضافة بصمات ليوم سابق أو لاحق';
            END IF;
        END IF;

        -- B. Inspect raw_punches array and enforce server time on new punch
        IF v_sanitized_updates ? 'raw_punches' AND jsonb_typeof(v_sanitized_updates->'raw_punches') = 'array' THEN
            v_raw_punches := v_sanitized_updates->'raw_punches';
            v_punch_count := jsonb_array_length(v_raw_punches);

            IF v_punch_count > 0 THEN
                v_last_punch := v_raw_punches->(v_punch_count - 1);

                IF v_last_punch ? 'time' THEN
                    BEGIN
                        v_client_time := (v_last_punch->>'time')::timestamptz;
                        v_time_drift_seconds := abs(EXTRACT(EPOCH FROM (v_client_time - v_now)));
                        
                        -- If client time differs by 90+ seconds, flag clock tampering
                        IF v_time_drift_seconds >= 90 THEN
                            v_security_note := ' [رصد اختلاف ساعة الجهاز بمقدار ' || round(v_time_drift_seconds) || ' ثانية - اعتُمد توقيت السيرفر الرسمي]';
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        v_security_note := ' [صيغة توقيت غير صالحة - اعتُمد توقيت السيرفر الرسمي]';
                    END;
                END IF;

                -- OVERWRITE the latest punch timestamp with the canonical server timestamp
                v_last_punch := jsonb_set(v_last_punch, '{time}', to_jsonb(v_now_utc_str));
                v_raw_punches := jsonb_set(v_raw_punches, ARRAY[(v_punch_count - 1)::text], v_last_punch);
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{raw_punches}', v_raw_punches);
            END IF;
        END IF;

        -- C. For new record (check-in), enforce check_in = v_now
        IF p_record_id IS NULL THEN
            IF v_sanitized_updates ? 'check_in' AND v_sanitized_updates->>'check_in' IS NOT NULL THEN
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{check_in}', to_jsonb(v_now_utc_str));
            END IF;
        ELSE
            -- For existing record updates:
            -- If check_out is being set or updated, enforce check_out = v_now
            IF v_sanitized_updates ? 'check_out' AND v_sanitized_updates->>'check_out' IS NOT NULL THEN
                IF v_existing_record.check_out IS NULL OR (v_sanitized_updates->>'check_out')::timestamptz <> v_existing_record.check_out THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{check_out}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;

            -- If time_leave_out is being newly set, enforce v_now
            IF v_sanitized_updates ? 'time_leave_out' AND v_sanitized_updates->>'time_leave_out' IS NOT NULL THEN
                IF v_existing_record.time_leave_out IS NULL THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{time_leave_out}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;

            -- If time_leave_return is being newly set, enforce v_now
            IF v_sanitized_updates ? 'time_leave_return' AND v_sanitized_updates->>'time_leave_return' IS NOT NULL THEN
                IF v_existing_record.time_leave_return IS NULL THEN
                    v_sanitized_updates := jsonb_set(v_sanitized_updates, '{time_leave_return}', to_jsonb(v_now_utc_str));
                END IF;
            END IF;
        END IF;

        -- D. Append security note if tampering was detected
        IF v_security_note <> '' THEN
            IF v_sanitized_updates ? 'notes' AND v_sanitized_updates->>'notes' IS NOT NULL THEN
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{notes}', to_jsonb(v_sanitized_updates->>'notes' || v_security_note));
            ELSE
                v_sanitized_updates := jsonb_set(v_sanitized_updates, '{notes}', to_jsonb(v_security_note));
            END IF;
        END IF;
    END IF;

    -- ====================================================================
    -- EXECUTE DATABASE INSERT OR UPDATE
    -- ====================================================================
    IF p_record_id IS NOT NULL THEN
        -- UPDATE existing record safely
        UPDATE public.attendance_records
        SET 
            check_in = CASE 
                WHEN v_sanitized_updates ? 'check_in' THEN (v_sanitized_updates->>'check_in')::timestamptz 
                ELSE check_in 
            END,
            check_out = CASE 
                WHEN v_sanitized_updates ? 'check_out' THEN (v_sanitized_updates->>'check_out')::timestamptz 
                ELSE check_out 
            END,
            check_in_location = CASE 
                WHEN v_sanitized_updates ? 'check_in_location' THEN v_sanitized_updates->>'check_in_location' 
                ELSE check_in_location 
            END,
            check_out_location = CASE 
                WHEN v_sanitized_updates ? 'check_out_location' THEN v_sanitized_updates->>'check_out_location' 
                ELSE check_out_location 
            END,
            check_in_verified_by_biometric = CASE 
                WHEN v_sanitized_updates ? 'check_in_verified_by_biometric' THEN (v_sanitized_updates->>'check_in_verified_by_biometric')::boolean 
                ELSE check_in_verified_by_biometric 
            END,
            check_out_verified_by_biometric = CASE 
                WHEN v_sanitized_updates ? 'check_out_verified_by_biometric' THEN (v_sanitized_updates->>'check_out_verified_by_biometric')::boolean 
                ELSE check_out_verified_by_biometric 
            END,
            check_in_device_id = CASE 
                WHEN v_sanitized_updates ? 'check_in_device_id' THEN v_sanitized_updates->>'check_in_device_id' 
                ELSE check_in_device_id 
            END,
            check_out_device_id = CASE 
                WHEN v_sanitized_updates ? 'check_out_device_id' THEN v_sanitized_updates->>'check_out_device_id' 
                ELSE check_out_device_id 
            END,
            check_in_snapshot_url = CASE 
                WHEN v_sanitized_updates ? 'check_in_snapshot_url' THEN v_sanitized_updates->>'check_in_snapshot_url' 
                ELSE check_in_snapshot_url 
            END,
            check_out_snapshot_url = CASE 
                WHEN v_sanitized_updates ? 'check_out_snapshot_url' THEN v_sanitized_updates->>'check_out_snapshot_url' 
                ELSE check_out_snapshot_url 
            END,
            time_leave_out = CASE 
                WHEN v_sanitized_updates ? 'time_leave_out' THEN (v_sanitized_updates->>'time_leave_out')::timestamptz 
                ELSE time_leave_out 
            END,
            time_leave_return = CASE 
                WHEN v_sanitized_updates ? 'time_leave_return' THEN (v_sanitized_updates->>'time_leave_return')::timestamptz 
                ELSE time_leave_return 
            END,
            time_leave_out_2 = CASE 
                WHEN v_sanitized_updates ? 'time_leave_out_2' THEN (v_sanitized_updates->>'time_leave_out_2')::timestamptz 
                ELSE time_leave_out_2 
            END,
            time_leave_return_2 = CASE 
                WHEN v_sanitized_updates ? 'time_leave_return_2' THEN (v_sanitized_updates->>'time_leave_return_2')::timestamptz 
                ELSE time_leave_return_2 
            END,
            notes = CASE 
                WHEN v_sanitized_updates ? 'notes' THEN v_sanitized_updates->>'notes' 
                ELSE notes 
            END,
            admin_notes = CASE 
                WHEN v_sanitized_updates ? 'admin_notes' THEN v_sanitized_updates->>'admin_notes' 
                ELSE admin_notes 
            END,
            status = CASE 
                WHEN v_sanitized_updates ? 'status' THEN v_sanitized_updates->>'status' 
                ELSE status 
            END,
            is_device_pending = CASE 
                WHEN v_sanitized_updates ? 'is_device_pending' THEN (v_sanitized_updates->>'is_device_pending')::boolean 
                ELSE is_device_pending 
            END,
            raw_punches = CASE 
                WHEN v_sanitized_updates ? 'raw_punches' THEN v_sanitized_updates->'raw_punches' 
                ELSE raw_punches 
            END,
            overtime_minutes = CASE 
                WHEN v_sanitized_updates ? 'overtime_minutes' THEN (v_sanitized_updates->>'overtime_minutes')::integer 
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
            NULLIF(v_sanitized_updates->>'department_id', '')::uuid,
            NULLIF(v_sanitized_updates->>'work_schedule_id', '')::uuid,
            (v_sanitized_updates->>'check_in')::timestamptz,
            (v_sanitized_updates->>'check_out')::timestamptz,
            v_sanitized_updates->>'check_in_location',
            v_sanitized_updates->>'check_out_location',
            COALESCE((v_sanitized_updates->>'check_in_verified_by_biometric')::boolean, false),
            COALESCE((v_sanitized_updates->>'check_out_verified_by_biometric')::boolean, false),
            v_sanitized_updates->>'check_in_device_id',
            v_sanitized_updates->>'check_out_device_id',
            v_sanitized_updates->>'check_in_snapshot_url',
            v_sanitized_updates->>'check_out_snapshot_url',
            (v_sanitized_updates->>'time_leave_out')::timestamptz,
            (v_sanitized_updates->>'time_leave_return')::timestamptz,
            (v_sanitized_updates->>'time_leave_out_2')::timestamptz,
            (v_sanitized_updates->>'time_leave_return_2')::timestamptz,
            v_sanitized_updates->>'notes',
            COALESCE(v_sanitized_updates->>'status', 'present'),
            COALESCE((v_sanitized_updates->>'is_device_pending')::boolean, false),
            COALESCE(v_sanitized_updates->'raw_punches', '[]'::jsonb),
            COALESCE((v_sanitized_updates->>'overtime_minutes')::integer, 0),
            v_now,
            v_now
        )
        RETURNING to_jsonb(attendance_records.*) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

COMMIT;
