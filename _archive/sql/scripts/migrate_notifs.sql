DO $function$
DECLARE
    v_req RECORD;
    v_manager UUID;
    v_emp_name TEXT;
BEGIN
    FOR v_req IN SELECT * FROM public.leave_requests WHERE status = 'pending' AND leave_status = 'pending' LOOP
        SELECT full_name INTO v_emp_name FROM public.profiles WHERE id = v_req.user_id;
        
        IF v_req.approval_chain IS NOT NULL THEN
            FOREACH v_manager IN ARRAY v_req.approval_chain LOOP
                -- تأكد من عدم تكرار الإشعار
                IF NOT EXISTS (SELECT 1 FROM public.system_notifications WHERE type = 'leave_request' AND recipient_id = v_manager AND metadata->>'request_id' = v_req.id::text) THEN
                    INSERT INTO public.system_notifications (
                        recipient_id, sender_id, type, title, content, metadata
                    ) VALUES (
                        v_manager, v_req.user_id, 'leave_request', 'طلب إجازة جديد',
                        'قدم ' || COALESCE(v_emp_name, 'موظف') || ' طلب إجازة بحاجة لموافقتك',
                        jsonb_build_object('request_id', v_req.id, 'leave_type', v_req.leave_type)
                    );
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$function$;
