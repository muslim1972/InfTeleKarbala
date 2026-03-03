-- 1. Ensure all old approved requests are marked as deducted so they can be refunded!
UPDATE public.leave_requests 
SET is_deducted = TRUE 
WHERE (status = 'approved' OR leave_status = 'approved') 
  AND is_deducted = FALSE;

-- 2. Drop any potentially interfering old triggers
-- We drop the specific known old triggers to be safe.
DROP TRIGGER IF EXISTS leave_request_status_update ON public.leave_requests;
DROP TRIGGER IF EXISTS handle_leave_approval ON public.leave_requests;

-- If there's any trigger firing the old handle_leave_approval function, drop it:
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname, proname
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgrelid = 'public.leave_requests'::regclass 
          AND tgisinternal = false
          AND tgname != 'leave_state_machine_trigger'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.leave_requests';
    END LOOP;
END;
$$;

-- 3. Reload PostgREST schema cache to ensure new columns are fully recognized by the API
NOTIFY pgrst, 'reload schema';
