-- ============================================================
-- Fix 1: submit_typed_leave_request (الإشعارات الصحيحة)
-- ============================================================
DROP FUNCTION IF EXISTS public.submit_typed_leave_request;

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
BEGIN
    /* Validate Leave Type */
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع إجازة غير صالح');
    END IF;

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
            'طلب إجازة جديد',
            'طلب جديد بانتظار موافقتك. (' || p_reason || ')',
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
-- Fix 2: convert_cumulative_time (الإشعارات الصحيحة لـ HR)
-- ============================================================
CREATE OR REPLACE FUNCTION public.convert_cumulative_time()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_days INTEGER;
    v_minutes_remaining INTEGER;
    v_new_request_id UUID;
    v_hr_id UUID;
BEGIN
    FOR v_user IN
        SELECT user_id, cumulative_minutes
        FROM public.financial_records
        WHERE cumulative_minutes >= 420
    LOOP
        v_days := FLOOR(v_user.cumulative_minutes / 420);
        v_minutes_remaining := v_user.cumulative_minutes % 420;
        
        -- أ) إضافة الطلب للـ HR (cumulative_time)
        INSERT INTO public.leave_requests (
            user_id, leave_type, start_date, end_date, days_count, status, leave_status, reason, converted_to_cumulative
        ) VALUES (
            v_user.user_id, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, 'approved', 'approved', 'تحويل تلقائي للزمنيات المتراكمة', TRUE
        ) RETURNING id INTO v_new_request_id;
        
        -- ب) إضافة سجل الأرشفة
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            v_user.user_id, EXTRACT(YEAR FROM CURRENT_DATE), 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, NOW()
        );
        
        -- ج) خصم الزمنيات وخصم الإجازات
        UPDATE public.financial_records
        SET 
            cumulative_minutes = v_minutes_remaining,
            remaining_leaves_balance = remaining_leaves_balance - v_days
        WHERE user_id = v_user.user_id;

        -- د) أرسل إشعار لـ HR
        FOR v_hr_id IN (
            SELECT id FROM public.profiles WHERE role = 'admin' OR admin_role = 'hr_supervisor'
        ) LOOP
            INSERT INTO public.system_notifications (
                recipient_id,
                sender_id,
                type,
                title,
                content,
                metadata,
                created_at
            ) VALUES (
                v_hr_id,
                v_user.user_id, -- الموظف المعني
                'system_alert',
                'تحويل زمنيات تراكمية',
                'تم تحويل ' || v_days || ' يوم للموظف.',
                jsonb_build_object('leave_type', 'cumulative_time', 'days', v_days),
                NOW()
            );
        END LOOP;

    END LOOP;
END;
$$;
