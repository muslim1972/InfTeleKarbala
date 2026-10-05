SELECT public.submit_typed_leave_request(
    'regular',
    CURRENT_DATE,
    CURRENT_DATE,
    1,
    'Testing from agent 2',
    'd79c5d50-b30c-4d0d-821f-a6093bfaa877',
    ARRAY['d79c5d50-b30c-4d0d-821f-a6093bfaa877']::uuid[],
    NULL,
    NULL,
    true,
    NULL,
    NULL,
    false
);
