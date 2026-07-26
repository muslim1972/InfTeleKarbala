    /* Insert Request */
    INSERT INTO public.leave_requests (
        user_id,
        leave_type,
        NOW()
    ) RETURNING id INTO v_new_request_id;
    -- إرسال إشعار للمسؤول المباشر
    /* Notify Supervisor */
    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id, type, title, body, data, created_at
            p_supervisor_id,
            'leave_request',
            'طلب إجازة جديد',
            'طلب جديد بانتظار موافقتك.',
            'طلب جديد بانتظار موافقتك',
            jsonb_build_object('request_id', v_new_request_id, 'leave_type', p_leave_type),
            NOW()
        );
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'تم تقديم طلب الإجازة بنجاح.',
        'message', 'Request submitted successfully',
        'request_id', v_new_request_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
$$;
