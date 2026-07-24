CREATE OR REPLACE FUNCTION public.modify_leave_request(
    p_request_id uuid,
    p_modification_type text,
    p_start_date date DEFAULT NULL::date,
    p_days_count integer DEFAULT NULL::integer,
    p_end_date date DEFAULT NULL::date,
    p_cut_date date DEFAULT NULL::date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req record;
    v_first_supervisor uuid;
BEGIN
    SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id;
    
    IF v_req IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'الطلب غير موجود.');
    END IF;

    -- حالة الإلغاء
    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET modification_type = 'canceled',
            cancellation_status = 'pending'
        WHERE id = p_request_id;
        
        RETURN json_build_object('success', true, 'message', 'تم تقديم طلب الإلغاء.');
        
    -- حالة القطع
    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET modification_type = 'cut',
            cut_status = 'pending',
            cut_date = p_cut_date
        WHERE id = p_request_id;
        
        RETURN json_build_object('success', true, 'message', 'تم تقديم طلب القطع.');
        
    -- حالة التعديل
    ELSIF p_modification_type = 'edited' THEN
        -- المنطق المنطقي: عند تعديل طلب حتى لو كان موافق عليه، يجب أن يعود إلى "قيد الانتظار" 
        -- لكي يوافق عليه المسؤول من جديد على الأيام الجديدة.
        
        -- تحديد المسؤول الأول لكي يعود الطلب للموافقة من البداية
        IF v_req.approval_chain IS NOT NULL AND array_length(v_req.approval_chain, 1) > 0 THEN
            v_first_supervisor := v_req.approval_chain[1];
        ELSE
            v_first_supervisor := v_req.supervisor_id;
        END IF;

        UPDATE public.leave_requests
        SET modification_type = 'edited',
            start_date = p_start_date,
            days_count = p_days_count,
            end_date = p_end_date,
            status = 'pending',             -- إرجاع حالة المسؤول إلى قيد الانتظار
            leave_status = 'pending',       -- إرجاع حالة النظام إلى قيد الانتظار
            current_approval_step = 1,      -- تصفير سلسلة الموافقات
            supervisor_id = v_first_supervisor, -- توجيه الطلب للمدير المباشر الأول
            is_read_by_employee = false
        WHERE id = p_request_id;
        
        RETURN json_build_object('success', true, 'message', 'تم التعديل وإرسال الطلب للموافقة من جديد.');
    END IF;

    RETURN json_build_object('success', false, 'message', 'نوع التعديل غير معروف.');
END;
$$;
