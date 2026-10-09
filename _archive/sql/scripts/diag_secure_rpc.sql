\echo '=== تعريف submit_attendance_record_secure الحي (كامل) ==='
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'submit_attendance_record_secure';

\echo '=== أعمدة attendance_records ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'attendance_records' ORDER BY ordinal_position;

\echo '=== أعمدة profiles ذات الصلة ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id','full_name','job_number','position','job_title','department_id','face_descriptor','work_schedule_id','role','admin_role','avatar_url','primary_device_id')
ORDER BY ordinal_position;
