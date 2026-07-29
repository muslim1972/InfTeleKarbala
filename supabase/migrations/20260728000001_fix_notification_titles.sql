-- ============================================================
-- Fix 1: submit_typed_leave_request 
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_typed_leave_request(
    p_leave_type text,
    p_start_date date,
    p_end_date date,
    p_days_count integer,
    p_reason text,
    p_supervisor_id uuid,
    p_approval_chain uuid[],
    p_time_duration_minutes integer DEFAULT NULL,
    p_destination text DEFAULT NULL,
    p_with_pay boolean DEFAULT true,
    p_supporting_image_urls text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_request_id uuid;
    v_leave_type_ar text;
BEGIN
    /* Validate Leave Type */
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع إجازة غير صالح');
    END IF;

    CASE p_leave_type
        WHEN 'time_off' THEN v_leave_type_ar := 'إجازة زمنية';
        WHEN 'duty' THEN v_leave_type_ar := 'واجب';
        WHEN 'dispatch' THEN v_leave_type_ar := 'إيفاد';
        WHEN 'regular' THEN v_leave_type_ar := 'إجازة اعتيادية';
        WHEN 'sick' THEN v_leave_type_ar := 'إجازة مرضية';
        ELSE v_leave_type_ar := 'إجازة';
    END CASE;

    /* Insert Request */
    INSERT INTO public.leave_requests (
        user_id,
        leave_type,
        start_date,
        end_date,
        days_count,
        reason,
        supervisor_id,
        approval_chain,
        time_duration_minutes,
        destination,
        with_pay,
        supporting_image_urls,
        status,
        leave_status,
        created_at
    ) VALUES (
        auth.uid(),
        p_leave_type,
        p_start_date,
        p_end_date,
        p_days_count,
        p_reason,
        p_supervisor_id,
        p_approval_chain,
        p_time_duration_minutes,
        p_destination,
        p_with_pay,
        p_supporting_image_urls,
        'pending',
        'pending',
        NOW()
    ) RETURNING id INTO v_new_request_id;

    /* إرسال إشعار للمسؤول المباشر عبر جدول system_notifications الصحيح */
    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            type,
            title,
            content,
            metadata,
            created_at
        ) VALUES (
            p_supervisor_id,
            auth.uid(),
            'leave_request',
            'طلب ' || v_leave_type_ar || ' جديد',
            'طلب ' || v_leave_type_ar || ' جديد بانتظار موافقتك. (' || p_reason || ')',
            jsonb_build_object('request_id', v_new_request_id, 'leave_type', p_leave_type),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'تم تقديم طلب الإجازة بنجاح.',
        'request_id', v_new_request_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- ============================================================
-- Fix 2: process_leave_approval 
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_leave_approval(
    p_request_id uuid,
    p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request record;
    v_current_step integer;
    v_chain_length integer;
    v_next_supervisor uuid;
    v_leave_type_ar text;
BEGIN
    -- 1. Fetch the request
    SELECT * INTO v_request
    FROM public.leave_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    -- Security check
    IF v_request.supervisor_id != auth.uid() AND NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالموافقة على هذا الطلب');
    END IF;

    CASE v_request.leave_type
        WHEN 'time_off' THEN v_leave_type_ar := 'إجازة زمنية';
        WHEN 'duty' THEN v_leave_type_ar := 'واجب';
        WHEN 'dispatch' THEN v_leave_type_ar := 'إيفاد';
        WHEN 'regular' THEN v_leave_type_ar := 'إجازة اعتيادية';
        WHEN 'sick' THEN v_leave_type_ar := 'إجازة مرضية';
        ELSE v_leave_type_ar := 'إجازة';
    END CASE;

    -- 2. Handle rejection
    IF p_action = 'rejected' THEN
        UPDATE public.leave_requests
        SET status = 'rejected',
            leave_status = 'rejected',
            is_read_by_employee = false
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    -- 3. Handle Approval
    IF p_action = 'approved' THEN
        v_current_step := COALESCE(v_request.current_approval_step, 1);
        v_chain_length := array_length(v_request.approval_chain, 1);

        IF v_chain_length IS NOT NULL AND v_current_step < v_chain_length THEN
            -- Escalate to next manager
            v_next_supervisor := v_request.approval_chain[v_current_step + 1];
            
            UPDATE public.leave_requests
            SET current_approval_step = v_current_step + 1,
                supervisor_id = v_next_supervisor
            WHERE id = p_request_id;

            -- Notify escalated manager
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_next_supervisor, v_request.user_id, 'leave_request', 'طلب ' || v_leave_type_ar || ' معلق',
                'تم تحويل طلب ' || v_leave_type_ar || ' إليك وبانتظار موافقتك.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );

            RETURN jsonb_build_object('success', true, 'status', 'escalated', 'next_supervisor', v_next_supervisor);
        ELSE
            -- Final approval
            UPDATE public.leave_requests
            SET status = 'approved',
                leave_status = 'approved',
                is_read_by_employee = false
            WHERE id = p_request_id;

            RETURN jsonb_build_object('success', true, 'status', 'approved');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- ============================================================
-- Fix 3: modify_leave_request_status 
-- ============================================================
CREATE OR REPLACE FUNCTION public.modify_leave_request_status(
    p_request_id uuid,
    p_modification_type text,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_days_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request record;
    v_user_id uuid;
    v_first_supervisor uuid;
    v_leave_type_ar text;
BEGIN
    v_user_id := auth.uid();
    
    SELECT * INTO v_request
    FROM public.leave_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود.');
    END IF;

    IF v_request.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بتعديل هذا الطلب.');
    END IF;

    IF v_request.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'لا يمكن تعديل طلب غير معتمد بعد.');
    END IF;

    CASE v_request.leave_type
        WHEN 'time_off' THEN v_leave_type_ar := 'إجازة زمنية';
        WHEN 'duty' THEN v_leave_type_ar := 'واجب';
        WHEN 'dispatch' THEN v_leave_type_ar := 'إيفاد';
        WHEN 'regular' THEN v_leave_type_ar := 'إجازة اعتيادية';
        WHEN 'sick' THEN v_leave_type_ar := 'إجازة مرضية';
        ELSE v_leave_type_ar := 'إجازة';
    END CASE;

    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET modification_type = 'canceled',
            status = 'pending',                  
            leave_status = 'pending',            
            current_approval_step = 1,           
            supervisor_id = COALESCE((approval_chain)[1], supervisor_id),
            is_read_by_employee = false          
        WHERE id = p_request_id;
        
        v_first_supervisor := COALESCE((v_request.approval_chain)[1], v_request.supervisor_id);
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب إلغاء ' || v_leave_type_ar, 
                'طلب الموظف إلغاء ال' || v_leave_type_ar || ' وهو بانتظار موافقتك.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );
        END IF;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح.');

    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET modification_type = 'cut',
            status = 'pending',                  
            leave_status = 'pending',            
            current_approval_step = 1,           
            supervisor_id = COALESCE((approval_chain)[1], supervisor_id),
            is_read_by_employee = false          
        WHERE id = p_request_id;
        
        v_first_supervisor := COALESCE((v_request.approval_chain)[1], v_request.supervisor_id);
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب قطع ' || v_leave_type_ar, 
                'طلب الموظف قطع ال' || v_leave_type_ar || ' وهو بانتظار موافقتك.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح.');

    ELSIF p_modification_type = 'edited' THEN
        IF p_start_date IS NULL OR p_end_date IS NULL OR p_days_count IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'تاريخ التعديل غير مكتمل.');
        END IF;

        v_first_supervisor := COALESCE((v_request.approval_chain)[1], v_request.supervisor_id);

        UPDATE public.leave_requests
        SET start_date = COALESCE(p_start_date, start_date),
            end_date = COALESCE(p_end_date, end_date),
            days_count = COALESCE(p_days_count, days_count),
            modification_type = 'edited',
            status = 'pending',                  
            leave_status = 'pending',            
            current_approval_step = 1,           
            supervisor_id = v_first_supervisor,  
            is_read_by_employee = false          
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب ' || v_leave_type_ar || ' معدل', 
                'تم تعديل طلب ' || v_leave_type_ar || ' وهو بانتظار موافقتك من جديد.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'تم التعديل وإرسال الطلب للموافقة من جديد.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'نوع التعديل غير صالح.');
    END IF;
END;
$$;
