-- 20260225_add_leave_modifications.sql

-- 1. Add new columns to `leave_requests` table
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS modification_type TEXT DEFAULT NULL, -- 'edited', 'canceled', 'cut'
ADD COLUMN IF NOT EXISTS cut_date DATE DEFAULT NULL;

-- 2. Create RPC to handle modification
CREATE OR REPLACE FUNCTION public.modify_leave_request(
    p_request_id UUID,
    p_modification_type TEXT, -- 'edited', 'canceled', 'cut'
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_days_count INTEGER DEFAULT NULL,
    p_cut_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_request RECORD;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. User not logged in.');
    END IF;

    -- Fetch request
    SELECT * INTO v_request 
    FROM public.leave_requests 
    WHERE id = p_request_id;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found.');
    END IF;

    -- Check if user owns the request
    IF v_request.user_id != v_user_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Forbidden. Not your request.');
    END IF;

    -- Update based on modification type
    IF p_modification_type IN ('edited', 'canceled', 'cut') THEN
        UPDATE public.leave_requests
        SET 
            modification_type = p_modification_type,
            start_date = COALESCE(p_start_date, start_date),
            end_date = COALESCE(p_end_date, end_date),
            days_count = COALESCE(p_days_count, days_count),
            cut_date = p_cut_date,
            status = 'pending' -- Reset status to pending so manager can see it again
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Request modified successfully.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid modification type.');
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.modify_leave_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_leave_request TO service_role;
