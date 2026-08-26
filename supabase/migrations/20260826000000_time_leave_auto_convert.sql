-- ============================================================
-- تحويل الإجازات الزمنية المتجاوزة ساعتين (حتى لو تلفيقياً) إلى إجازة اعتيادية
-- RPC جديد: submit_time_leave_auto_converted
--   - يُدرج الإجازة الاعتيادية مباشرة كـ"معتمدة" في سجل إجازات الموظف
--   - يُرسل إشعارات فورية إلى ثلاث جهات:
--       1) المسؤول المباشر   2) الموارد البشرية (HR)   3) الموظف المعني
--     مع تفاصيل الطلب وسبب التحويل
-- نفّذ هذا السكريبت في SQL Editor في Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_time_leave_auto_converted(
    p_leave_date DATE,
    p_reason TEXT,
    p_supervisor_id UUID,
    p_approval_chain UUID[],
    p_total_minutes INTEGER,
    p_existing_minutes INTEGER DEFAULT 0,
    p_time_off_subtype TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id uuid;
    v_user_name TEXT;
    v_cumulative INTEGER;
    v_subtype_label TEXT;
    v_details TEXT;
    v_why TEXT;
    v_hr RECORD;
BEGIN
    v_cumulative := COALESCE(p_existing_minutes, 0) + COALESCE(p_total_minutes, 0);

    /* صيانة المدخلات */
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

    /* 1) إدراج الإجازة الاعتيادية معتمدة مباشرة (يوم واحد لنفس التاريخ) */
    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at, is_read_by_employee
    ) VALUES (
        auth.uid(), 'regular', p_leave_date, p_leave_date, 1, p_reason,
        p_supervisor_id, p_approval_chain, NULL, NULL,
        true, '{}', 'approved', 'approved',
        NULL, true, NOW(), false
    ) RETURNING id INTO v_request_id;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

    v_details := 'التاريخ: ' || to_char(p_leave_date, 'YYYY-MM-DD')
        || ' | النوع الزمني: ' || v_subtype_label
        || ' | مدة الطلب: ' || p_total_minutes || ' دقيقة'
        || CASE WHEN COALESCE(p_existing_minutes, 0) > 0
                THEN ' | مدد زمنية سابقة بنفس اليوم: ' || p_existing_minutes || ' دقيقة'
                ELSE '' END
        || ' | المجموع: ' || v_cumulative || ' دقيقة';

    v_why := 'السبب: تجاوز مجموع مدد الإجازات الزمنية لهذا اليوم حدي ساعتين (120 دقيقة)، فتم تحويل الطلب إلزامياً إلى إجازة اعتيادية معتمدة ليوم واحد.';

    /* 2) إشعار المسؤول المباشر */
    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            p_supervisor_id, auth.uid(), 'leave_auto_converted',
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
    END IF;

    /* 3) إشعار الموارد البشرية (HR) */
    FOR v_hr IN SELECT id FROM public.profiles WHERE role = 'admin' OR admin_role = 'hr_supervisor' LOOP
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

    /* 4) إشعار الموظف المعني */
    INSERT INTO public.system_notifications (
        recipient_id, sender_id, type, title, content, metadata, created_at
    ) VALUES (
        auth.uid(), auth.uid(), 'leave_auto_converted',
        'تم تحويل طلبك إلى إجازة اعتيادية معتمدة',
        'طلبك الزمني حُوِّل تلقائياً إلى إجازة اعتيادية معتمدة ليوم واحد. ' || v_details || '. ' || v_why,
        jsonb_build_object(
            'request_id', v_request_id,
            'leave_type', 'regular',
            'converted_from', 'time_off',
            'leave_date', p_leave_date,
            'total_minutes', v_cumulative
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تحويل الطلب إلى إجازة اعتيادية معتمدة وإشعار الجهات المعنية.',
        'request_id', v_request_id,
        'converted', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
