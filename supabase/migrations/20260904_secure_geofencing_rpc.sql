-- ====================================================================
-- migration: 20260904_secure_geofencing_rpc.sql
-- تحصين التحقق الجغرافي الخادمي (Server-Side Geofence Enforcement)
-- في دالة submit_attendance_record_secure
-- ====================================================================

CREATE OR REPLACE FUNCTION public.submit_attendance_record_secure(
    p_employee_id uuid,
    p_record_id uuid DEFAULT NULL,
    p_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id uuid;
    v_caller_role text;
    v_caller_admin_role text;
    v_is_admin boolean := false;
    v_result jsonb;
    v_now timestamptz := now();
    
    -- متغيرات التدقيق الجغرافي الخادمي
    v_loc_text text;
    v_lat float8;
    v_lng float8;
    v_loc_record record;
    v_dist float8;
    v_min_dist float8 := 999999999;
    v_within_geofence boolean := false;
    v_has_locations boolean := false;
    v_coord_matches text[];
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
    END IF;

    -- جلب صلاحيات المنفّذ
    SELECT role, admin_role INTO v_caller_role, v_caller_admin_role
    FROM profiles
    WHERE id = v_caller_id;

    IF v_caller_role = 'admin' OR v_caller_role = 'hr_manager' OR
       v_caller_admin_role = 'developer' OR v_caller_admin_role = 'general' THEN
        v_is_admin := true;
    END IF;

    -- منع تسجيل البصمة لموظف آخر إلا إذا كان مسؤولاً
    IF v_caller_id != p_employee_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'غير مصرح: لا يمكنك تسجيل أو تعديل بصمة موظف آخر';
    END IF;

    -- ================================================================
    -- التدقيق الجغرافي الخادمي (Server-Side Geofencing)
    -- ================================================================
    -- نستخرج نص الموقع من check_in_location أو check_out_location أو أحدث بصمة في raw_punches
    v_loc_text := COALESCE(
        p_updates->>'check_out_location',
        p_updates->>'check_in_location'
    );

    IF v_loc_text IS NULL AND p_updates ? 'raw_punches' THEN
        SELECT (p->>'location') INTO v_loc_text
        FROM jsonb_array_elements(p_updates->'raw_punches') AS p
        ORDER BY (p->>'time')::timestamptz DESC
        LIMIT 1;
    END IF;

    -- إذا وُجد نص موقع، نستخرج الإحداثيات (خط العرض وخط الطول)
    IF v_loc_text IS NOT NULL AND NOT v_is_admin THEN
        v_coord_matches := regexp_match(v_loc_text, '^([0-9]+\.[0-9]+),\s*([0-9]+\.[0-9]+)');
        
        IF v_coord_matches IS NOT NULL AND array_length(v_coord_matches, 1) >= 2 THEN
            v_lat := v_coord_matches[1]::float8;
            v_lng := v_coord_matches[2]::float8;

            -- فحص المسافة بين الإحداثيات وكافة مواقع العمل المعتمدة للموظف
            FOR v_loc_record IN
                SELECT wl.id, wl.name, wl.latitude, wl.longitude, wl.radius_meters
                FROM work_location_employees wle
                JOIN work_locations wl ON wl.id = wle.location_id
                WHERE wle.employee_id = p_employee_id
                  AND wl.is_active = true
                  AND wl.latitude != 0
                  AND wl.longitude != 0
            LOOP
                v_has_locations := true;

                -- حساب المسافة بصيغة Haversine مباشرة بالأمتار
                v_dist := 6371000 * 2 * asin(
                    sqrt(
                        power(sin(radians(v_lat - v_loc_record.latitude) / 2), 2) +
                        cos(radians(v_loc_record.latitude)) * cos(radians(v_lat)) *
                        power(sin(radians(v_lng - v_loc_record.longitude) / 2), 2)
                    )
                );

                IF v_dist < v_min_dist THEN
                    v_min_dist := v_dist;
                END IF;

                -- السماح إذا كان داخل نصف القطر المعتمد (مع هامش سماح 50 متراً لانحراف الإشارة داخل المباني)
                IF v_dist <= (v_loc_record.radius_meters + 50) THEN
                    v_within_geofence := true;
                    EXIT;
                END IF;
            END LOOP;

            -- إذا كان الموظف لديه مواقع عمل معتمدة ولكنه خارجها تماماً، يتم رفض العملية خادمياً
            IF v_has_locations AND NOT v_within_geofence THEN
                RAISE EXCEPTION 'فشل التحقق الخادمي: موقعك الجغرافي خارج نطاق العمل المعتمد (المسافة: % متر)', round(v_min_dist::numeric);
            END IF;
        END IF;
    END IF;

    -- ================================================================
    -- تنفيذ الإدراج أو التحديث
    -- ================================================================
    IF p_record_id IS NOT NULL THEN
        UPDATE attendance_records
        SET
            check_in                        = COALESCE((p_updates->>'check_in')::timestamptz, check_in),
            check_out                       = COALESCE((p_updates->>'check_out')::timestamptz, check_out),
            check_in_location               = COALESCE(p_updates->>'check_in_location', check_in_location),
            check_out_location              = COALESCE(p_updates->>'check_out_location', check_out_location),
            check_in_verified_by_biometric  = COALESCE((p_updates->>'check_in_verified_by_biometric')::boolean, check_in_verified_by_biometric),
            check_out_verified_by_biometric = COALESCE((p_updates->>'check_out_verified_by_biometric')::boolean, check_out_verified_by_biometric),
            check_in_device_id              = COALESCE(p_updates->>'check_in_device_id', check_in_device_id),
            check_out_device_id             = COALESCE(p_updates->>'check_out_device_id', check_out_device_id),
            check_in_snapshot_url           = COALESCE(p_updates->>'check_in_snapshot_url', check_in_snapshot_url),
            check_out_snapshot_url          = COALESCE(p_updates->>'check_out_snapshot_url', check_out_snapshot_url),
            time_leave_out                  = COALESCE((p_updates->>'time_leave_out')::timestamptz, time_leave_out),
            time_leave_return               = COALESCE((p_updates->>'time_leave_return')::timestamptz, time_leave_return),
            time_leave_out_2                = COALESCE((p_updates->>'time_leave_out_2')::timestamptz, time_leave_out_2),
            time_leave_return_2             = COALESCE((p_updates->>'time_leave_return_2')::timestamptz, time_leave_return_2),
            notes                           = COALESCE(p_updates->>'notes', notes),
            status                          = COALESCE(p_updates->>'status', status),
            is_device_pending               = COALESCE((p_updates->>'is_device_pending')::boolean, is_device_pending),
            raw_punches                     = COALESCE(p_updates->'raw_punches', raw_punches),
            overtime_minutes                = COALESCE((p_updates->>'overtime_minutes')::integer, overtime_minutes),
            updated_at                      = v_now
        WHERE id = p_record_id
          AND (employee_id = p_employee_id OR v_is_admin)
        RETURNING to_jsonb(attendance_records.*) INTO v_result;

        IF v_result IS NULL THEN
            RAISE EXCEPTION 'السجل المطلوب تعديله غير موجود أو لا تملك صلاحية عليه';
        END IF;
    ELSE
        INSERT INTO attendance_records (
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
