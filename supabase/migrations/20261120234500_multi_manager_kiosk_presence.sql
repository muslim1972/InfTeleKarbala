-- Migration: Support Multi-Responsibility Management and Extend Kiosk Presence
-- Author: Eng. Muslim A. Abdul-Hassan & Deliberation Council
-- Date: 2026-11-20

-- 1. Modify sync_dept_manager_assignment()
-- Decouple manager/deputy assignment from profiles.department_id
-- and allow an employee to manage multiple departments/complexes simultaneously.
CREATE OR REPLACE FUNCTION public.sync_dept_manager_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Multi-responsibility governance:
    -- Assigning a manager or deputy to a department does NOT overwrite their primary profile department,
    -- nor does it clear other departments they manage.
    RETURN NEW;
END;
$function$;

-- 2. Modify sync_profile_to_work_location_and_manager()
-- Preserve Part A (triangular synchronization for regular employees when profiles.department_id changes).
-- Remove Part B (clearing manager_id of other departments when user moves).
CREATE OR REPLACE FUNCTION public.sync_profile_to_work_location_and_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_loc_id uuid;
    v_curr_loc_id uuid;
BEGIN
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        -- A. Sync work location via strict department_id FK
        IF NEW.department_id IS NOT NULL THEN
            SELECT id INTO v_loc_id
              FROM work_locations
             WHERE department_id = NEW.department_id
             LIMIT 1;

            IF v_loc_id IS NOT NULL THEN
                SELECT location_id INTO v_curr_loc_id
                  FROM work_location_employees
                 WHERE employee_id = NEW.id;

                IF v_curr_loc_id IS DISTINCT FROM v_loc_id THEN
                    INSERT INTO work_location_employees (location_id, employee_id)
                    VALUES (v_loc_id, NEW.id)
                    ON CONFLICT (employee_id)
                    DO UPDATE SET location_id = EXCLUDED.location_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 3. Modify kiosk_get_employees(p_code text)
-- Dynamically authorize managers and deputies at kiosks corresponding to the departments they manage.
CREATE OR REPLACE FUNCTION public.kiosk_get_employees(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_code text := trim(upper(p_code));
    v_device public.kiosk_devices%ROWTYPE;
BEGIN
    IF NOT public.kiosk_device_check(v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'message', 'رمز التفعيل غير صالح أو الجهاز موقوف');
    END IF;

    SELECT * INTO v_device FROM public.kiosk_devices WHERE activation_code = v_clean_code;
    IF v_device.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الجهاز غير موجود');
    END IF;

    -- Update last seen for device
    UPDATE public.kiosk_devices SET last_seen_at = now() WHERE id = v_device.id;

    RETURN jsonb_build_object(
        'success', true,
        'device_governorate', v_device.governorate,
        'device_name', v_device.name,
        'employees', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'job_number', p.job_number,
                'governorate', p.governorate,
                'department_id', p.department_id,
                'department_name', COALESCE(d.name, 'غير محدد'),
                'dept_text', COALESCE(NULLIF(p.dept_text, ''), d.name, 'غير محدد'),
                'section_text', COALESCE(NULLIF(p.section_text, ''), (
                    CASE WHEN d.level = 4 THEN d.name ELSE '' END
                )),
                'unit_text', COALESCE(p.unit_text, ''),
                'schedule_name', ws.name,
                'today_start', wsd.start_time,
                'today_end', wsd.end_time,
                'today_rest', COALESCE(wsd.is_rest_day, true),
                'today_is_evening', COALESCE(wsd.is_evening, false),
                'today_is_night', COALESCE(wsd.is_night, false),
                'face_descriptor', p.face_descriptor,
                'assigned_location_ids', COALESCE((
                    WITH RECURSIVE managed_depts AS (
                        -- Departments where this employee is primary Manager or Deputy
                        SELECT dept.id, dept.parent_id
                        FROM public.departments dept
                        WHERE dept.manager_id = p.id OR dept.deputy_manager_id = p.id
                        UNION ALL
                        -- Descendant departments
                        SELECT c.id, c.parent_id
                        FROM public.departments c
                        JOIN managed_depts md ON c.parent_id = md.id
                    ),
                    all_authorized_depts AS (
                        SELECT id FROM managed_depts
                        UNION
                        SELECT parent_id AS id FROM managed_depts WHERE parent_id IS NOT NULL
                    ),
                    all_locs AS (
                        -- 1. Primary work location
                        SELECT wle.location_id
                        FROM public.work_location_employees wle
                        WHERE wle.employee_id = p.id

                        UNION

                        -- 2. Locations of managed departments/complexes
                        SELECT wl.id AS location_id
                        FROM public.work_locations wl
                        WHERE wl.department_id IN (SELECT id FROM all_authorized_depts)
                          AND wl.is_active = true
                    )
                    SELECT jsonb_agg(DISTINCT location_id)
                    FROM all_locs
                    WHERE location_id IS NOT NULL
                ), '[]'::jsonb)
            ))
            FROM public.profiles p
            LEFT JOIN public.departments d ON d.id = p.department_id
            LEFT JOIN public.work_schedules ws ON ws.id = p.work_schedule_id
            LEFT JOIN public.work_schedule_days wsd
                   ON wsd.schedule_id = p.work_schedule_id
                  AND wsd.day_of_week = (EXTRACT(DOW FROM (clock_timestamp() AT TIME ZONE 'Asia/Baghdad'))::int)
            WHERE p.face_descriptor IS NOT NULL
              AND COALESCE(p.role, 'employee') NOT IN ('visitor', 'kiosk')
              AND p.governorate = v_device.governorate
        ), '[]'::jsonb)
    );
END;
$function$;
