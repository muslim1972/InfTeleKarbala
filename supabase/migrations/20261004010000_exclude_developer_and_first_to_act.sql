-- Migration: Exclude developer from device approvals & notifications, and implement first-to-act race settlement
-- 1. Exclude developer from device_change_requests RLS
-- 2. Restrict device mismatch notifications strictly to general and biometric supervisors
-- 3. Atomic settlement function & trigger to resolve notifications across all supervisors instantly

-- 1. Function: submit_device_change_request
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

    -- 3. STRICTLY Notify ONLY General and Biometric Supervisors in the same governorate (NO DEVELOPERS)
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE admin_role IN ('general', 'biometric')
          AND (admin_role IS DISTINCT FROM 'developer')
          AND (governorate IS NULL OR governorate = v_employee_gov OR v_employee_gov IS NULL)
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

-- 2. Function: notify_device_mismatch
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

    -- STRICTLY Notify ONLY General and Biometric Supervisors in the same governorate (NO DEVELOPERS)
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE admin_role IN ('general', 'biometric')
          AND (admin_role IS DISTINCT FROM 'developer')
          AND (governorate IS NULL OR governorate = v_employee_gov OR v_employee_gov IS NULL)
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

-- 3. Atomic settlement function: settle_device_change_request
CREATE OR REPLACE FUNCTION public.settle_device_change_request(
    p_request_id UUID,
    p_action TEXT,
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_admin_role TEXT;
    v_rec RECORD;
    v_clean_note TEXT;
BEGIN
    -- 1. Check admin permission: Strictly 'general' or 'biometric'
    SELECT admin_role INTO v_admin_role
    FROM public.profiles
    WHERE id = p_admin_id;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('general', 'biometric') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'PERMISSION_DENIED',
            'message', 'ليس لديك صلاحية اعتماد أو رفض الأجهزة. هذه الصلاحية للمشرف العام ومشرف البصمة فقط.'
        );
    END IF;

    -- 2. Lock and retrieve request row
    SELECT * INTO v_req
    FROM public.device_change_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'message', 'طلب تغيير الجهاز غير موجود.'
        );
    END IF;

    -- 3. Race condition check: Has another supervisor already acted?
    IF v_req.status != 'pending' THEN
        -- Immediately clear any leftover notifications for this admin just in case
        UPDATE public.system_notifications
        SET is_read = true
        WHERE type = 'device_mismatch'
          AND (
              (metadata->>'request_id')::text = p_request_id::text
              OR (metadata->>'employee_id')::text = v_req.employee_id::text
          );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_SETTLED',
            'message', 'تم اتخاذ إجراء مسبقاً على هذا الطلب من قبل مشرف آخر (' || 
                       CASE WHEN v_req.status = 'approved' THEN 'تم اعتماده' ELSE 'تم رفضه' END || ').'
        );
    END IF;

    -- 4. Process approval or rejection
    IF p_action = 'approve' THEN
        -- Update profile primary device
        UPDATE public.profiles
        SET primary_device_id = v_req.new_device_id
        WHERE id = v_req.employee_id;

        -- Clean up attendance notes and unmark pending status
        FOR v_rec IN 
            SELECT id, notes FROM public.attendance_records
            WHERE employee_id = v_req.employee_id AND is_device_pending = true
        LOOP
            v_clean_note := COALESCE(v_rec.notes, '');
            v_clean_note := regexp_replace(v_clean_note, '\(?دخول:\s*جهاز غير معتمد\)?', '', 'gi');
            v_clean_note := regexp_replace(v_clean_note, '\(?خروج:\s*جهاز غير معتمد\)?', '', 'gi');
            v_clean_note := regexp_replace(v_clean_note, '\(?تم التسجيل من جهاز غير معتمد\)?', '', 'gi');
            v_clean_note := trim(regexp_replace(v_clean_note, '\s*-\s*', ' ', 'g'));
            IF v_clean_note = '' THEN v_clean_note := NULL; END IF;

            UPDATE public.attendance_records
            SET is_device_pending = false,
                notes = v_clean_note
            WHERE id = v_rec.id;
        END LOOP;

        -- Update request status
        UPDATE public.device_change_requests
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_request_id;

        -- Notify employee
        INSERT INTO public.system_notifications (
            recipient_id,
            type,
            title,
            content
        ) VALUES (
            v_req.employee_id,
            'system',
            'تم اعتماد جهازك الجديد',
            'تمت الموافقة على جهازك الجديد لتسجيل البصمة واعتماده بنجاح.'
        );

    ELSIF p_action = 'reject' THEN
        -- Delete pending records
        DELETE FROM public.attendance_records
        WHERE employee_id = v_req.employee_id
          AND is_device_pending = true;

        -- Update request status
        UPDATE public.device_change_requests
        SET status = 'rejected',
            updated_at = now()
        WHERE id = p_request_id;

        -- Notify employee
        INSERT INTO public.system_notifications (
            recipient_id,
            type,
            title,
            content
        ) VALUES (
            v_req.employee_id,
            'system',
            'تم رفض جهازك الجديد',
            'تم رفض طلبك لاعتماد الجهاز الجديد لتسجيل البصمة. يرجى مراجعة الإدارة.'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_ACTION',
            'message', 'إجراء غير معروف.'
        );
    END IF;

    -- 5. FIRST-TO-ACT SETTLEMENT: Instantly dismiss & mark as read ALL notifications for all supervisors
    UPDATE public.system_notifications
    SET is_read = true
    WHERE type = 'device_mismatch'
      AND (
          (metadata->>'request_id')::text = p_request_id::text
          OR (metadata->>'employee_id')::text = v_req.employee_id::text
      );

    RETURN jsonb_build_object(
        'success', true,
        'action', p_action
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Automatic Trigger on device_change_requests update
CREATE OR REPLACE FUNCTION public.on_device_change_request_settled()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        UPDATE public.system_notifications
        SET is_read = true
        WHERE type = 'device_mismatch'
          AND (
              (metadata->>'request_id')::text = NEW.id::text
              OR (metadata->>'employee_id')::text = NEW.employee_id::text
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_device_change_request_settled ON public.device_change_requests;
CREATE TRIGGER trg_device_change_request_settled
AFTER UPDATE ON public.device_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_device_change_request_settled();

-- 5. Strict RLS Policies on device_change_requests (Excluding Developer)
DROP POLICY IF EXISTS "device_change_requests_select" ON public.device_change_requests;
CREATE POLICY "device_change_requests_select" ON public.device_change_requests
FOR SELECT USING (
    (auth.uid() = employee_id) OR 
    (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.admin_role IN ('general', 'biometric')
    ))
);

DROP POLICY IF EXISTS "device_change_requests_update" ON public.device_change_requests;
CREATE POLICY "device_change_requests_update" ON public.device_change_requests
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.admin_role IN ('general', 'biometric')
    )
);

DROP POLICY IF EXISTS "device_change_requests_delete" ON public.device_change_requests;
CREATE POLICY "device_change_requests_delete" ON public.device_change_requests
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.admin_role IN ('general', 'biometric')
    )
);

-- 6. Cleanup existing notifications: Mark all old device_mismatch notifications for developers as read
UPDATE public.system_notifications sn
SET is_read = true
FROM public.profiles p
WHERE sn.recipient_id = p.id
  AND sn.type = 'device_mismatch'
  AND p.admin_role = 'developer';
