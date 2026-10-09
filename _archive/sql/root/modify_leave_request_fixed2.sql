CREATE OR REPLACE FUNCTION public.modify_leave_request(p_request_id uuid, p_modification_type text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_days_count integer DEFAULT NULL::integer, p_cut_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_request RECORD;
    v_first_supervisor UUID;
BEGIN
    -- [الحارس]: التحقق من المصادقة
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
    END IF;

    -- جلب الطلب والتأكد من وجوده
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;
    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود.');
    END IF;

    -- [حماية الملكية]: التأكد أن الموظف يعدل طلبه هو فقط
    IF v_request.user_id != v_user_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بتعديل هذا الطلب.');
    END IF;

    -- معالجة الإلغاء
    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET cancellation_status = 'pending', modification_type = 'canceled'
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NULL AND v_request.approval_chain IS NOT NULL AND array_length(v_request.approval_chain, 1) > 0 THEN
            v_first_supervisor := (v_request.approval_chain)[1];
        ELSIF v_first_supervisor IS NULL THEN
            v_first_supervisor := v_request.supervisor_id;
        END IF;
        
        -- تحديث الطلب ليعود للمشرف الأول للموافقة على الإلغاء
        UPDATE public.leave_requests
        SET current_approval_step = 1, supervisor_id = v_first_supervisor
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب إلغاء إجازة', 
                CASE WHEN v_first_supervisor = v_user_id THEN 'السيد مدير المديرية . بما انه لا يوجد طبقة عليا في المديرية تستلم طلبك ... لذا يرجى الموافقة عليه بنفسك' ELSE 'طلب الموظف إلغاء إجازته المعتمدة مسبقاً' END,
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type, 'is_cancellation_request', true), NOW()
            );
        END IF;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح.');

    -- معالجة قطع الإجازة
    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET cut_status = 'pending', cut_date = p_cut_date, modification_type = 'cut'
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح.');

    -- تعديل بيانات الطلب المعلق
    ELSIF p_modification_type = 'edited' THEN
        IF v_request.leave_status != 'pending' THEN
             RETURN jsonb_build_object('success', false, 'message', 'لا يمكن تعديل طلب تمت معالجته مسبقاً.');
        END IF;

        UPDATE public.leave_requests
        SET start_date = COALESCE(p_start_date, start_date),
            end_date = COALESCE(p_end_date, end_date),
            days_count = COALESCE(p_days_count, days_count),
            modification_type = 'edited'
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تعديل الطلب بنجاح.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'نوع التعديل غير صالح.');
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.modify_leave_request(p_request_id uuid, p_modification_type text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_days_count integer DEFAULT NULL::integer, p_cut_date date DEFAULT NULL::date, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_request RECORD;
    v_first_supervisor UUID;
BEGIN
    -- [الحارس]: التحقق من المصادقة 
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
    END IF;

    -- جلب الطلب والتأكد من وجوده
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;
    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود.');
    END IF;

    -- [حماية الملكية]: التأكد أن الموظف يعدل طلبه هو فقط
    IF v_request.user_id::text != v_user_id::text THEN
         RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بتعديل هذا الطلب.');
    END IF;

    -- معالجة الإلغاء
    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET cancellation_status = 'pending', modification_type = 'canceled', cancellation_reason = p_cancellation_reason
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NULL AND v_request.approval_chain IS NOT NULL AND array_length(v_request.approval_chain, 1) > 0 THEN
            v_first_supervisor := (v_request.approval_chain)[1];
        ELSIF v_first_supervisor IS NULL THEN
            v_first_supervisor := v_request.supervisor_id;
        END IF;
        
        -- تحديث الطلب ليعود للمشرف الأول للموافقة على الإلغاء
        UPDATE public.leave_requests
        SET current_approval_step = 1, supervisor_id = v_first_supervisor
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب إلغاء إجازة', 
                CASE WHEN v_first_supervisor = v_user_id THEN 'السيد مدير المديرية . بما انه لا يوجد طبقة عليا في المديرية تستلم طلبك ... لذا يرجى الموافقة عليه بنفسك' ELSE 'طلب الموظف إلغاء إجازته المعتمدة مسبقاً' END,
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type, 'is_cancellation_request', true), NOW()
            );
        END IF;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح.');

    -- معالجة قطع الإجازة
    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET cut_status = 'pending', cut_date = p_cut_date, modification_type = 'cut'
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح.');

    -- تعديل بيانات الطلب
    ELSIF p_modification_type = 'edited' THEN
        IF v_request.approval_chain IS NOT NULL AND array_length(v_request.approval_chain, 1) > 0 THEN
            v_first_supervisor := (v_request.approval_chain)[1];
        ELSE
            v_first_supervisor := v_request.supervisor_id;
        END IF;

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
                v_first_supervisor, v_user_id, 'leave_request', 'طلب إجازة معدل', 
                'تم تعديل طلب إجازة وهو بانتظار موافقتك من جديد.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'تم التعديل وإرسال الطلب للموافقة من جديد.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'نوع التعديل غير صالح.');
    END IF;
END;
$function$;



