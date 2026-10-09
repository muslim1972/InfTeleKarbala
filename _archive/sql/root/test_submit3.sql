DO $DO$
DECLARE
    v_res jsonb;
BEGIN
    PERFORM set_config('request.jwt.claims', '{"sub":"2a24e7bf-357a-4587-9461-8289dfe802dc", "role":"authenticated"}', true);
    v_res := public.submit_typed_leave_request('regular', CURRENT_DATE, CURRENT_DATE, 1, 'Testing from agent 3', 'd79c5d50-b30c-4d0d-821f-a6093bfaa877', ARRAY['d79c5d50-b30c-4d0d-821f-a6093bfaa877']::uuid[], NULL, NULL, true, NULL, NULL, false);
    CREATE TABLE IF NOT EXISTS test_res (res jsonb);
    INSERT INTO test_res VALUES (v_res);
END;
$DO$;
SELECT * FROM test_res;
DROP TABLE test_res;
