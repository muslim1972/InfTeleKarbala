-- ============================================================
-- تحديث دالة submit_typed_leave_request
-- لدعم المعاملات الجديدة: p_time_off_subtype و p_with_request
-- نفّذ هذا السكريبت في SQL Editor في Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_typed_leave_request(
    p_leave_type TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_reason TEXT,
    p_supervisor_id UUID,
    p_approval_chain UUID[],
    p_time_duration_minutes INTEGER DEFAULT NULL,
    p_destination TEXT DEFAULT NULL,
    p_with_pay BOOLEAN DEFAULT true,
    p_supporting_image_urls TEXT[] DEFAULT '{}',
    p_time_off_subtype TEXT DEFAULT NULL,
    p_with_request BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_request_id uuid;
    v_subtype_label TEXT;
    v_notif_title TEXT;
    v_notif_content TEXT;
    v_user_name TEXT;
BEGIN
    /* التحقق من نوع الإجازة */
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع إجازة غير صالح');
    END IF;

    /* التحقق من نوع الزمنية الفرعي */
    IF p_time_off_subtype IS NOT NULL AND p_time_off_subtype NOT IN ('mid_shift', 'shift_start', 'shift_end') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع زمنية فرعي غير صالح');
    END IF;

    /* إدراج الطلب */
    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at
    ) VALUES (
        auth.uid(), p_leave_type, p_start_date, p_end_date, p_days_count, p_reason,
        p_supervisor_id, p_approval_chain, p_time_duration_minutes, p_destination,
        p_with_pay, p_supporting_image_urls, 'pending', 'pending',
        p_time_off_subtype, p_with_request, NOW()
    ) RETURNING id INTO v_new_request_id;

    /* جلب اسم الموظف */
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

    /* تحديد نص الإشعار حسب النوع */
    IF p_leave_type = 'time_off' THEN
        v_subtype_label := CASE p_time_off_subtype
            WHEN 'mid_shift' THEN 'وسط الدوام'
            WHEN 'shift_start' THEN 'بداية الدوام'
            WHEN 'shift_end' THEN 'نهاية الدوام'
            ELSE 'زمنية'
        END;
        v_notif_title := 'طلب إجازة زمنية — ' || v_subtype_label;
        v_notif_content := COALESCE(v_user_name, 'موظف') || ' يطلب إجازة زمنية (' || v_subtype_label || ') بمدة ' || COALESCE(p_time_duration_minutes, 0) || ' دقيقة.';
    ELSE
        v_notif_title := 'طلب إجازة جديد';
        v_notif_content := 'طلب جديد بانتظار موافقتك. (' || COALESCE(p_reason, '') || ')';
    END IF;

    /* إرسال إشعار للمسؤول المباشر */
    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            p_supervisor_id, auth.uid(), 'leave_request',
            v_notif_title, v_notif_content,
            jsonb_build_object(
                'request_id', v_new_request_id,
                'leave_type', p_leave_type,
                'time_off_subtype', p_time_off_subtype,
                'with_request', p_with_request
            ),
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
