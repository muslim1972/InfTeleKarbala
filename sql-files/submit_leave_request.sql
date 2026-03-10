-- First, drop the existing function to avoid conflicts with parameter defaults or signatures
DROP FUNCTION IF EXISTS public.submit_leave_request(DATE, DATE, INTEGER, TEXT, UUID);

-- Function to submit a leave request with balance check, overlap check, prohibited days check, AND supervisor
CREATE OR REPLACE FUNCTION public.submit_leave_request(
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_reason TEXT,
    p_supervisor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance INTEGER;
    v_request_id UUID;
    v_unpaid_days INTEGER := 0;
    v_overlap_exists BOOLEAN;
    v_day_of_week INTEGER;
    v_month INTEGER;
    v_day_of_month INTEGER;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if days_count is valid
    IF p_days_count <= 0 THEN
        RAISE EXCEPTION 'Days count must be positive';
    END IF;

    IF p_days_count > 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'لا يمكن للإجازة الاعتيادية أن تتجاوز 10 أيام.'
        );
    END IF;

    -- 1. Prohibited days check (Weekends & Holidays)
    -- Check start_date
    v_day_of_week := EXTRACT(DOW FROM p_start_date); -- 0 = Sunday, 5 = Friday, 6 = Saturday
    v_month := EXTRACT(MONTH FROM p_start_date);
    v_day_of_month := EXTRACT(DAY FROM p_start_date);
    
    IF v_day_of_week IN (5, 6) OR 
       (v_month = 1 AND v_day_of_month IN (1, 6)) OR
       (v_month = 3 AND v_day_of_month IN (16, 21)) OR
       (v_month = 5 AND v_day_of_month = 1) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'لا يجوز ان يصادف يوم البداية يوم جمعة او سبت او عطلة رسمية.'
        );
    END IF;

    -- Check expected return date (p_end_date)
    -- Saturday = rejected, Friday/Holiday = auto-adjust to next working day
    v_day_of_week := EXTRACT(DOW FROM p_end_date);
    IF v_day_of_week = 6 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'لا يجوز ان يصادف يوم المباشرة المتوقعة يوم سبت. يرجى تعديل عدد الأيام.'
        );
    END IF;

    -- Auto-adjust: skip Fridays and holidays forward
    LOOP
        v_day_of_week := EXTRACT(DOW FROM p_end_date);
        v_month := EXTRACT(MONTH FROM p_end_date);
        v_day_of_month := EXTRACT(DAY FROM p_end_date);

        IF v_day_of_week = 5 THEN
            -- Friday → skip to Sunday (+2)
            p_end_date := p_end_date + 2;
        ELSIF (v_month = 1 AND v_day_of_month IN (1, 6)) OR
              (v_month = 3 AND v_day_of_month IN (16, 21)) OR
              (v_month = 5 AND v_day_of_month = 1) THEN
            -- Holiday → advance one day
            p_end_date := p_end_date + 1;
        ELSE
            EXIT; -- Valid working day found
        END IF;
    END LOOP;

    -- 2. Overlap check
    -- Prevent submission if there's any pending or approved request that overlaps in leave_requests
    SELECT EXISTS (
        SELECT 1 FROM public.leave_requests
        WHERE user_id = v_user_id
        AND (leave_status IN ('pending', 'approved') OR status IN ('pending', 'approved'))
        AND cancellation_status != 'approved'
        AND (
            (start_date, end_date) OVERLAPS (p_start_date, p_end_date)
        )
    ) INTO v_overlap_exists;

    IF v_overlap_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'يوجد طلب إجازة اعتيادية آخر متداخل مع هذه الفترة.'
        );
    END IF;

    -- Check overlap with five_year_leaves
    SELECT EXISTS (
        SELECT 1 FROM public.five_year_leaves
        WHERE user_id = v_user_id
        AND status = 'active'
        AND (
            (start_date, end_date) OVERLAPS (p_start_date, p_end_date)
        )
    ) INTO v_overlap_exists;

    IF v_overlap_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'هذه الفترة تتداخل مع إجازة خمس سنوات فعالة.'
        );
    END IF;

    -- 3. Balance check
    SELECT COALESCE(remaining_leaves_balance, 0)
    INTO v_current_balance
    FROM public.financial_records
    WHERE user_id = v_user_id
    LIMIT 1;

    -- Calculate unpaid days if balance is insufficient
    IF v_current_balance < p_days_count THEN
        v_unpaid_days := p_days_count - v_current_balance;
    END IF;

    -- 4. Insert request
    INSERT INTO public.leave_requests (
        user_id,
        start_date,
        end_date,
        days_count,
        reason,
        status,           -- Old column (backward compatibility)
        leave_status,     -- New column (V2 architecture)
        supervisor_id,
        unpaid_days
    ) VALUES (
        v_user_id,
        p_start_date,
        p_end_date,
        p_days_count,
        p_reason,
        'pending',
        'pending',
        p_supervisor_id,
        v_unpaid_days
    )
    RETURNING id INTO v_request_id;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تقديم طلب الإجازة بنجاح، بانتظار موافقة المسؤول.',
        'request_id', v_request_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'حدث خطأ غير متوقع: ' || SQLERRM
    );
END;
$$;
