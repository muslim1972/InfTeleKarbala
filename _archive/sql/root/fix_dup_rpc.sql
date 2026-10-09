CREATE OR REPLACE FUNCTION public.submit_typed_leave_request(p_leave_type text, p_start_date date, p_end_date date, p_days_count integer, p_reason text, p_supervisor_id uuid, p_approval_chain uuid[], p_time_duration_minutes integer DEFAULT NULL::integer, p_destination text DEFAULT NULL::text, p_with_pay boolean DEFAULT true, p_supporting_image_urls text[] DEFAULT NULL::text[], p_time_off_subtype text DEFAULT NULL::text, p_with_request boolean DEFAULT false, p_leave_start_time time without time zone DEFAULT NULL::time without time zone, p_leave_end_time time without time zone DEFAULT NULL::time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_new_request_id uuid;
    v_manager uuid;
    v_emp_name text;
    v_conflict_exists boolean;
BEGIN
    SELECT full_name INTO v_emp_name FROM public.profiles WHERE id = auth.uid();

    -- التحقق من التعارضات المكررة
    SELECT EXISTS (
        SELECT 1 FROM public.leave_requests 
        WHERE user_id = auth.uid() 
          AND status IN ('pending', 'approved')
          AND (cancellation_status IS NULL OR cancellation_status != 'approved')
          AND (
              (p_leave_type != 'time_off' AND p_start_date <= end_date AND p_end_date >= start_date)
              OR 
              (p_leave_type = 'time_off' AND leave_type != 'time_off' AND p_start_date <= end_date AND p_end_date >= start_date)
              OR
              (p_leave_type = 'time_off' AND leave_type = 'time_off' AND start_date = p_start_date)
          )
    ) INTO v_conflict_exists;

    IF v_conflict_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'يوجد طلب إجازة مسبق يتعارض مع هذه التواريخ');
    END IF;

    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at,
        leave_start_time, leave_end_time
    ) VALUES (
        auth.uid(), p_leave_type, p_start_date, p_end_date, p_days_count, p_reason,
        p_supervisor_id, p_approval_chain, p_time_duration_minutes, p_destination,
        p_with_pay, p_supporting_image_urls, 'pending', 'pending',
        p_time_off_subtype, p_with_request, NOW(),
        p_leave_start_time, p_leave_end_time
    )
    RETURNING id INTO v_new_request_id;

    IF p_approval_chain IS NOT NULL THEN
        FOREACH v_manager IN ARRAY p_approval_chain LOOP
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata
            ) VALUES (
                v_manager, auth.uid(), 'leave_request', 'طلب إجازة جديد',
                CASE WHEN v_manager = auth.uid() THEN 'السيد مدير المديرية . بما انه لا يوجد طبقة عليا في المديرية تستلم طلبك ... لذا يرجى الموافقة عليه بنفسك' ELSE 'قدم ' || COALESCE(v_emp_name, 'موظف') || ' طلب إجازة بحاجة لموافقتك' END,
                jsonb_build_object('request_id', v_new_request_id, 'leave_type', p_leave_type)
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب الإجازة بنجاح.', 'request_id', v_new_request_id);
EXCEPTION WHEN OTHERS THEN 
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

