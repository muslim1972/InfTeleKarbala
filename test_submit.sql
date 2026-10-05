DO $DO$
DECLARE
    v_res jsonb;
BEGIN
    -- Set auth.uid to Bashir's ID
    PERFORM set_config('request.jwt.claims', '{"sub":"2a24e7bf-357a-4587-9461-8289dfe802dc", "role":"authenticated"}', true);
    
    v_res := public.submit_typed_leave_request(
        p_leave_type := 'regular',
        p_start_date := CURRENT_DATE,
        p_end_date := CURRENT_DATE,
        p_days_count := 1,
        p_reason := 'Testing from agent',
        p_supervisor_id := 'd79c5d50-b30c-4d0d-821f-a6093bfaa877',
        p_approval_chain := ARRAY['d79c5d50-b30c-4d0d-821f-a6093bfaa877']::uuid[],
        p_with_pay := true
    );
    RAISE NOTICE 'Result: %', v_res;
END;
$DO$;
