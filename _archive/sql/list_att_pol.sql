SELECT polname, polcmd, polroles::regrole[] FROM pg_policy WHERE polrelid = 'attendance_records'::regclass;
