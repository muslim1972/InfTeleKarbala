BEGIN;

REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (id, job_number, full_name, avatar_url, updated_at, card_number, username, role, avatar, admin_role, supervisor_level, last_modified_by, last_modified_by_name, last_modified_at, department_id, can_view_requests, graduation_year, work_nature, appointment_date, specialization, dept_text, section_text, unit_text, has_capacities_access, can_access_promotion, last_login, email, two_factor_enabled, two_factor_expires_at, is_promotion_lecturer, promotion_course_type, promotion_subject_name, is_training_supervisor, governorate, primary_device_id, work_schedule_id, face_descriptor, has_attendance_access) ON TABLE public.profiles TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
