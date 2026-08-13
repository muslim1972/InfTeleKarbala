-- Update submit_device_change_request RPC function to safely insert system notifications
-- bypassing RLS policies for regular employee check-in sessions.

CREATE OR REPLACE FUNCTION submit_device_change_request(
    p_employee_id UUID,
    p_old_device_id TEXT,
    p_new_device_id TEXT
) RETURNS void AS $$
DECLARE
    v_employee_name TEXT;
    v_admin_id UUID;
BEGIN
    -- 1. Insert the request if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM public.device_change_requests 
        WHERE employee_id = p_employee_id 
          AND new_device_id = p_new_device_id 
          AND status = 'pending'
    ) THEN
        INSERT INTO public.device_change_requests (employee_id, old_device_id, new_device_id, status)
        VALUES (p_employee_id, p_old_device_id, p_new_device_id, 'pending');
    END IF;

    -- 2. Get employee name
    SELECT full_name INTO v_employee_name FROM public.profiles WHERE id = p_employee_id;

    -- 3. ALWAYS Notify all admins & general supervisors (developer, general, biometric, admin)
    -- This inserts into system_notifications using SECURITY DEFINER privileges.
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE role = 'admin' 
           OR admin_role IN ('developer', 'general', 'biometric', 'hr', 'hr_supervisor')
    LOOP
        INSERT INTO public.system_notifications (recipient_id, title, content)
        VALUES (
            v_admin_id,
            'تنبيه: تسجيل من جهاز غير معتمد',
            'قام الموظف (' || COALESCE(v_employee_name, 'موظف') || ') بتسجيل البصمة من جهاز غير معتمد، يرجى المراجعة.'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
