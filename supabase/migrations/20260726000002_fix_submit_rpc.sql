-- Drop the old function first if it exists
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

    /* Note: We do NOT insert into public.notifications here.
       The client-side React code handles sending push notifications using sendPushNotification. */

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'تم تقديم طلب الإجازة بنجاح.',
        'request_id', v_new_request_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
