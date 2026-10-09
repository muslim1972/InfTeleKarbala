CREATE OR REPLACE FUNCTION public.process_leave_approval(p_request_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request RECORD;
    v_actor_name TEXT;
    v_emp_name TEXT;
    v_emp_gov TEXT;
    v_manager UUID;
    v_hr RECORD;
BEGIN
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    IF NOT (auth.uid() = ANY(v_request.approval_chain)) AND NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالموافقة على هذا الطلب');
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
    SELECT full_name, governorate INTO v_emp_name, v_emp_gov FROM public.profiles WHERE id = v_request.user_id;

    IF p_action = 'rejected' THEN
        UPDATE public.leave_requests
        SET status = 'rejected',
            leave_status = 'rejected',
            supervisor_id = auth.uid(),
            is_read_by_employee = false
        WHERE id = p_request_id;

        UPDATE public.system_notifications
        SET is_read = true
        WHERE metadata->>'request_id' = p_request_id::text AND type = 'leave_request';

        IF v_request.approval_chain IS NOT NULL THEN
            FOREACH v_manager IN ARRAY v_request.approval_chain LOOP
                IF v_manager != auth.uid() THEN
                    INSERT INTO public.system_notifications (
                        recipient_id, sender_id, type, title, content, metadata
                    ) VALUES (
                        v_manager, auth.uid(), 'leave_fyi', 'تم رفض طلب إجازة',
                        'قام ' || COALESCE(v_actor_name, 'مسؤول') || ' برفض طلب إجازة الموظف ' || COALESCE(v_emp_name, 'موظف'),
                        jsonb_build_object('request_id', p_request_id)
                    );
                END IF;
            END LOOP;
        END IF;

        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata
        ) VALUES (
            v_request.user_id, auth.uid(), 'leave_response', 'تم رفض طلب الإجازة',
            'تم رفض طلب إجازتك من قبل ' || COALESCE(v_actor_name, 'المسؤول'),
            jsonb_build_object('request_id', p_request_id)
        );

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    IF p_action = 'approved' THEN
        UPDATE public.leave_requests
        SET status = 'approved',
            leave_status = 'approved',
            supervisor_id = auth.uid(),
            is_read_by_employee = false
        WHERE id = p_request_id;

        UPDATE public.system_notifications
        SET is_read = true
        WHERE metadata->>'request_id' = p_request_id::text AND type = 'leave_request';

        IF v_request.approval_chain IS NOT NULL THEN
            FOREACH v_manager IN ARRAY v_request.approval_chain LOOP
                IF v_manager != auth.uid() THEN
                    INSERT INTO public.system_notifications (
                        recipient_id, sender_id, type, title, content, metadata
                    ) VALUES (
                        v_manager, auth.uid(), 'leave_fyi', 'تمت الموافقة على طلب إجازة',
                        'قام ' || COALESCE(v_actor_name, 'مسؤول') || ' بالموافقة على طلب إجازة الموظف ' || COALESCE(v_emp_name, 'موظف'),
                        jsonb_build_object('request_id', p_request_id)
                    );
                END IF;
            END LOOP;
        END IF;

        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata
        ) VALUES (
            v_request.user_id, auth.uid(), 'leave_response', 'تمت الموافقة على الإجازة',
            'تمت الموافقة على طلب إجازتك من قبل ' || COALESCE(v_actor_name, 'المسؤول'),
            jsonb_build_object('request_id', p_request_id)
        );

        FOR v_hr IN SELECT id FROM public.profiles 
                    WHERE governorate = v_emp_gov 
                      AND (admin_role IN ('hr_supervisor', 'biometric_supervisor', 'hr') OR role = 'admin') LOOP
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata
            ) VALUES (
                v_hr.id, auth.uid(), 'leave_hr', 'مطلوب توثيق إجازة معتمدة',
                'تمت الموافقة على إجازة الموظف ' || COALESCE(v_emp_name, 'موظف') || '. يرجى التوثيق.',
                jsonb_build_object('request_id', p_request_id)
            );
        END LOOP;

        RETURN jsonb_build_object('success', true, 'status', 'approved');
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
