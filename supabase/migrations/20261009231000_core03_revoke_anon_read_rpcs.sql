-- BE-CORE-03 / إصلاح أمني — المرحلة 3 (2026-10-09): دوال قراءة/كتابة مكشوفة لـ anon
-- كل مستدعيها في الواجهة يعمل بعد تسجيل الدخول (تحقق بتتبّع الكود: الزائر visitor والكشك kiosk يسجّلان دخولاً أيضاً).
-- تبقى لـ anon عمداً (قبل الدخول): get_login_profile، authenticate_user، check_rate_limit، update_rate_limit،
--   rpc_handle_forgot_password، check_user_exists (Login)، get_server_time، kiosk_activate، kiosk_device_check،
--   دوال المتدرّب الصيفي (authenticate_training_student، get_random_training_questions، get_active_training_poll، create_training_student)،
--   is_*/get_my_* (تعيد false/null للمجهول)، verify_password.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_available_profiles','get_available_profiles_by_ids','search_available_profiles','get_basic_profiles',
      'get_managed_employees','get_promotion_users','get_promotion_lecturers','search_promotion_candidates',
      'get_training_supervisors','check_employee_exists_global','get_departments_bypass_rls','convert_cumulative_time',
      'process_daily_attendance','submit_leave_request','submit_device_change_request','notify_admins_new_device',
      'notify_device_mismatch','kiosk_get_employees')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

SELECT p.proname, count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'execute')) AS anon_overloads
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
WHERE n.nspname = 'public' AND d.objid IS NULL AND p.prosecdef AND pg_get_function_result(p.oid) <> 'trigger'
GROUP BY p.proname HAVING count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'execute')) > 0
ORDER BY 1;

-- BE-CORE-03 المرحلة 3ب: دفاع في العمق — سحب anon من كل دالة DEFINER لا تلزم قبل الدخول (لها فحص uid داخلي أصلاً)
DO $$
DECLARE r record;
  allow text[] := ARRAY['authenticate_training_student','authenticate_user','check_rate_limit','check_user_exists','create_training_student',
    'get_active_training_poll','get_login_profile','get_random_training_questions','get_server_time','kiosk_activate','kiosk_device_check',
    'rpc_handle_forgot_password','update_rate_limit','verify_password','is_admin','is_finance_admin','is_hr_admin','is_kiosk_user',
    'is_media_admin','is_privileged_user','get_my_admin_role','get_my_governorate','get_auth_user_role','media_in_my_gov','poll_in_my_gov'];
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND d.objid IS NULL AND p.prosecdef AND pg_get_function_result(p.oid) <> 'trigger'
      AND has_function_privilege('anon', p.oid, 'execute') AND NOT (p.proname = ANY (allow))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    RAISE NOTICE 'revoked anon: %', r.sig;
  END LOOP;
END $$;
