SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polname = 'Allow Upload Attendance Snapshots';
SELECT id, name, public FROM storage.buckets WHERE id = 'attendance-snapshots';
