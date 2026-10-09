SELECT oid::regprocedure FROM pg_proc WHERE proname IN ('submit_typed_leave_request', 'submit_time_leave_auto_converted', 'process_leave_approval');
