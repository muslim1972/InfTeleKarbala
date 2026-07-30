-- Create RPC function to safely submit device change requests
CREATE OR REPLACE FUNCTION submit_device_change_request(
    p_employee_id UUID,
    p_old_device_id TEXT,
    p_new_device_id TEXT
) RETURNS void AS $$
DECLARE
    v_employee_name TEXT;
    v_admin_id UUID;
BEGIN
    -- Check if a pending request already exists to avoid duplicates
    IF EXISTS (
        SELECT 1 FROM public.device_change_requests 
        WHERE employee_id = p_employee_id 
          AND new_device_id = p_new_device_id 
          AND status = 'pending'
    ) THEN
        RETURN;
    END IF;

    -- Insert the request
    INSERT INTO public.device_change_requests (employee_id, old_device_id, new_device_id, status)
    VALUES (p_employee_id, p_old_device_id, p_new_device_id, 'pending');

    -- Get employee name
    SELECT full_name INTO v_employee_name FROM public.profiles WHERE id = p_employee_id;

    -- Notify admins
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE role = 'admin' AND admin_role IN ('developer', 'general', 'biometric')
    LOOP
        INSERT INTO public.system_notifications (recipient_id, title, content)
        VALUES (
            v_admin_id,
            'طلب اعتماد جهاز جديد',
            'طلب الموظف (' || COALESCE(v_employee_name, 'موظف') || ') اعتماد جهاز جديد لتسجيل الحضور. يرجى مراجعة الطلب في لوحة الإدارة.'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC for first-time device registration notification
CREATE OR REPLACE FUNCTION notify_admins_new_device(
    p_employee_name TEXT
) RETURNS void AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE role = 'admin' AND admin_role IN ('developer', 'general', 'biometric')
    LOOP
        INSERT INTO public.system_notifications (recipient_id, title, content)
        VALUES (
            v_admin_id,
            'تسجيل جهاز جديد',
            'قام الموظف (' || COALESCE(p_employee_name, 'موظف') || ') بتسجيل جهازه لأول مرة بنجاح.'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
