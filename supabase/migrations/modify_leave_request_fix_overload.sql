-- أولاً: نحذف النسختين لتنظيف قاعدة البيانات من أي تضارب
DROP FUNCTION IF EXISTS public.modify_leave_request(uuid, text, date, integer, date, date);
DROP FUNCTION IF EXISTS public.modify_leave_request(uuid, text, date, date, integer, date);

-- ثانياً: ننشئ الدالة بالترتيب الأصلي الدقيق الذي يتوقعه التطبيق
CREATE OR REPLACE FUNCTION public.modify_leave_request(
    p_request_id uuid,
    p_modification_type text,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_days_count integer DEFAULT NULL::integer,
    p_cut_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_request RECORD;
    v_first_supervisor UUID;
BEGIN
    -- [الحارس]: التحقق من المصادقة (ممارسات الأمن السيبراني)
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
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح.');

    -- معالجة قطع الإجازة
    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET cut_status = 'pending', cut_date = p_cut_date, modification_type = 'cut'
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح.');

    -- تعديل بيانات الطلب
    ELSIF p_modification_type = 'edited' THEN
        
        -- تحديد المسؤول المباشر الأول لكي يعود الطلب للموافقة من بداية السلسلة
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
            status = 'pending',                  -- إرجاع قرار المسؤول المباشر إلى الانتظار
            leave_status = 'pending',            -- إرجاع حالة الإجازة الكلية إلى الانتظار
            current_approval_step = 1,           -- تصفير السلسلة لتبدأ من جديد
            supervisor_id = v_first_supervisor,  -- توجيه الطلب للمسؤول الأول
            is_read_by_employee = false          -- لضمان التنبيه
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'تم التعديل وإرسال الطلب للموافقة من جديد.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'نوع التعديل غير صالح.');
    END IF;
END;
$$;
