SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polname = 'attendance_insert_policy';
