CREATE OR REPLACE FUNCTION public.submit_time_leave_auto_converted(p_leave_date date, p_reason text, p_supervisor_id uuid, p_approval_chain uuid[], p_total_minutes integer, p_existing_minutes integer DEFAULT 0, p_time_off_subtype text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_request_id uuid;
    v_user_name TEXT;
    v_cumulative INTEGER;
    v_subtype_label TEXT;
    v_details TEXT;
    v_why TEXT;
    v_hr RECORD;
    v_manager UUID;
    v_emp_gov TEXT;
BEGIN
    v_cumulative := COALESCE(p_existing_minutes, 0) + COALESCE(p_total_minutes, 0);

    IF p_leave_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'تاريخ الإجازة مطلوب');
    END IF;
    IF p_total_minutes IS NULL OR p_total_minutes <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'مدة الإجازة غير صالحة');
    END IF;

    v_subtype_label := CASE p_time_off_subtype
        WHEN 'mid_shift' THEN 'وسط الدوام'
        WHEN 'shift_start' THEN 'بداية الدوام'
        WHEN 'shift_end' THEN 'نهاية الدوام'
        ELSE 'زمنية'
    END;

    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at, is_read_by_employee
    ) VALUES (
        auth.uid(), 'regular', p_leave_date, p_leave_date, 1, p_reason,
        p_supervisor_id, p_approval_chain, NULL, NULL,
        true, '{}'::text[], 'pending', 'pending',
        NULL, true, NOW(), false
    ) RETURNING id INTO v_request_id;

    SELECT full_name, governorate INTO v_user_name, v_emp_gov FROM public.profiles WHERE id = auth.uid();

    v_details := 'زمنية محولة تلقائياً لتجاوز ' || (v_cumulative - p_total_minutes) || ' دقيقة سابقة';
    v_why := 'رصيد تراكمي: ' || v_cumulative || ' دقيقة';

    /* 2) إشعارات للمسؤولين في السلسلة */
    IF p_approval_chain IS NOT NULL THEN
        FOREACH v_manager IN ARRAY p_approval_chain LOOP
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_manager, auth.uid(), 'leave_request',
                'تحويل تلقائي إلى إجازة اعتيادية (مطلوب موافقتك)',
                COALESCE(v_user_name, 'موظف') || ' — ' || v_details || '. ' || v_why,
                jsonb_build_object(
                    'request_id', v_request_id,
                    'leave_type', 'regular',
                    'converted_from', 'time_off',
                    'leave_date', p_leave_date,
                    'total_minutes', v_cumulative
                ),
                NOW()
            );
        END LOOP;
    END IF;

    /* 3) إشعار الموارد البشرية (HR) في نفس المحافظة للعلم المسبق (اختياري، أو يمكن حذفه والاعتماد على ما بعد الموافقة) */
    FOR v_hr IN SELECT id FROM public.profiles WHERE governorate = v_emp_gov AND (role = 'admin' OR admin_role = 'hr_supervisor') LOOP
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            v_hr.id, auth.uid(), 'leave_auto_converted',
            'تحويل تلقائي إلى إجازة اعتيادية',
            COALESCE(v_user_name, 'موظف') || ' — ' || v_details || '. ' || v_why,
            jsonb_build_object(
                'request_id', v_request_id,
                'leave_type', 'regular',
                'converted_from', 'time_off',
                'leave_date', p_leave_date,
                'total_minutes', v_cumulative
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تجاوز 180 دقيقة، تم تحويل الطلب إلى إجازة اعتيادية (يوم واحد) ورفعه للمسؤول.',
        'request_id', v_request_id,
        'converted_to_regular', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
