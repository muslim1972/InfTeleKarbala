-- Migration: Fix device mismatch notifications & requests
-- Resolves not-null constraint violation on system_notifications.type
-- Adds biometric supervisor role to notification targets and RLS policies

-- 1. Fix submit_device_change_request
CREATE OR REPLACE FUNCTION public.submit_device_change_request(
    p_employee_id UUID,
    p_old_device_id TEXT,
    p_new_device_id TEXT
) RETURNS void AS $$
DECLARE
    v_employee_name TEXT;
    v_employee_gov TEXT;
    v_admin_id UUID;
    v_req_id UUID;
BEGIN
    -- 1. Insert the request if a pending request doesn't already exist
    SELECT id INTO v_req_id 
    FROM public.device_change_requests 
    WHERE employee_id = p_employee_id 
      AND new_device_id = p_new_device_id 
      AND status = 'pending'
    LIMIT 1;

    IF v_req_id IS NULL THEN
        INSERT INTO public.device_change_requests (employee_id, old_device_id, new_device_id, status)
        VALUES (p_employee_id, p_old_device_id, p_new_device_id, 'pending')
        RETURNING id INTO v_req_id;
    END IF;

    -- 2. Get employee name and governorate
    SELECT full_name, governorate INTO v_employee_name, v_employee_gov 
    FROM public.profiles 
    WHERE id = p_employee_id;

    -- 3. ALWAYS Notify all admins & general / biometric supervisors in the same governorate (developer sees all)
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE (
            role = 'admin' 
            OR admin_role IN ('developer', 'general', 'biometric', 'attendance', 'supervisor', 'hr', 'hr_supervisor')
        )
        AND (admin_role = 'developer' OR governorate IS NULL OR governorate = v_employee_gov OR v_employee_gov IS NULL)
        AND id != p_employee_id
    LOOP
        INSERT INTO public.system_notifications (
            recipient_id, 
            type, 
            title, 
            content,
            metadata
        ) VALUES (
            v_admin_id,
            'device_mismatch',
            'تنبيه: تسجيل من جهاز غير معتمد',
            'قام الموظف (' || COALESCE(v_employee_name, 'موظف') || ') بتسجيل البصمة من جهاز غير معتمد، يرجى مراجعة طلب اعتماد الجهاز.',
            jsonb_build_object(
                'request_id', v_req_id,
                'employee_id', p_employee_id,
                'type', 'device_change_request'
            )
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix notify_device_mismatch
CREATE OR REPLACE FUNCTION public.notify_device_mismatch(
    p_employee_id UUID
) RETURNS integer AS $$
DECLARE
    v_employee_name TEXT;
    v_employee_gov TEXT;
    v_admin_id UUID;
    v_count INTEGER := 0;
BEGIN
    SELECT full_name, governorate INTO v_employee_name, v_employee_gov 
    FROM public.profiles 
    WHERE id = p_employee_id;

    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE (
            role = 'admin' 
            OR admin_role IN ('developer', 'general', 'biometric', 'attendance', 'supervisor', 'hr', 'hr_supervisor')
        )
        AND (admin_role = 'developer' OR governorate IS NULL OR governorate = v_employee_gov OR v_employee_gov IS NULL)
        AND id != p_employee_id
    LOOP
        INSERT INTO public.system_notifications (
            recipient_id,
            type,
            title,
            content,
            metadata
        ) VALUES (
            v_admin_id,
            'device_mismatch',
            'تنبيه: تسجيل من جهاز غير معتمد',
            'قام الموظف (' || COALESCE(v_employee_name, 'موظف') || ') بتسجيل البصمة من جهاز غير معتمد، يرجى مراجعة طلب اعتماد الجهاز.',
            jsonb_build_object('employee_id', p_employee_id)
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update RLS policies on device_change_requests
DROP POLICY IF EXISTS "device_change_requests_select" ON public.device_change_requests;
CREATE POLICY "device_change_requests_select" ON public.device_change_requests
FOR SELECT USING (
    (auth.uid() = employee_id) OR 
    (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND (
            profiles.role = 'admin' 
            OR profiles.admin_role IN ('general', 'developer', 'biometric', 'attendance', 'supervisor', 'hr', 'hr_supervisor')
            OR profiles.role IN ('developer', 'supervisor')
          )
    ))
);

DROP POLICY IF EXISTS "device_change_requests_update" ON public.device_change_requests;
CREATE POLICY "device_change_requests_update" ON public.device_change_requests
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND (
            profiles.role = 'admin' 
            OR profiles.admin_role IN ('general', 'developer', 'biometric', 'attendance', 'supervisor', 'hr', 'hr_supervisor')
            OR profiles.role IN ('developer', 'supervisor')
          )
    )
);

DROP POLICY IF EXISTS "device_change_requests_delete" ON public.device_change_requests;
CREATE POLICY "device_change_requests_delete" ON public.device_change_requests
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND (
            profiles.role = 'admin' 
            OR profiles.admin_role IN ('general', 'developer', 'biometric', 'attendance', 'supervisor', 'hr', 'hr_supervisor')
          )
    )
);
