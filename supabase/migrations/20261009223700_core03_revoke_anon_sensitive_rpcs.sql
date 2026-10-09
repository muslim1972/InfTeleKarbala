-- BE-CORE-03 / إصلاح أمني عاجل 2026-10-09
-- المشكلة: دوال SECURITY DEFINER قابلة للتنفيذ من الدور anon (أي شخص يملك مفتاح anon العام في الواجهة)
-- وبلا تحقق هوية داخلي. أخطرها rpc_sync_user_auth: تغيير كلمة سر/بريد أي مستخدم = استيلاء كامل على الحساب.
-- الإصلاح (المرحلة 1، بلا أثر وظيفي): سحب التنفيذ من PUBLIC/anon لدوال لا تُستدعى إلا بعد تسجيل الدخول.
-- الدوال غير المستخدمة في الكود تُسحب من authenticated أيضاً.
-- المرحلة 2 (لاحقاً بموافقة): تحقق دور داخلي (is_admin/is_hr_admin) داخل كل دالة إدارية.

REVOKE EXECUTE ON FUNCTION public.rpc_sync_user_auth(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_delete_user_robust(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_delete_user_auth(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_monthly_snapshot(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clone_departments_tree(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_work_locations_for_governorate(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.append_deleted_by(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reset_test_attendance(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debug_modify_check(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('activate_monthly_snapshot','sync_active_monthly_snapshot','commit_monthly_snapshot','settle_device_change_request','reset_test_attendance_today')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.proname = 'reset_test_attendance_today' THEN EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig); END IF;
  END LOOP;
END $$;

-- ضمان بقاء التنفيذ للمستخدم المسجّل للدوال المستخدمة فعلاً في الواجهة
GRANT EXECUTE ON FUNCTION public.rpc_sync_user_auth(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_robust(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_monthly_snapshot(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_departments_tree(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_deleted_by(uuid, uuid) TO authenticated, service_role;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('activate_monthly_snapshot','sync_active_monthly_snapshot','commit_monthly_snapshot','settle_device_change_request')
  LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig); END LOOP;
END $$;

SELECT p.proname, has_function_privilege('anon', p.oid, 'execute') AS anon, has_function_privilege('authenticated', p.oid, 'execute') AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('rpc_sync_user_auth','rpc_delete_user_robust','rpc_delete_user_auth','delete_monthly_snapshot','clone_departments_tree','ensure_work_locations_for_governorate','append_deleted_by','reset_test_attendance','reset_test_attendance_today','debug_modify_check','activate_monthly_snapshot','sync_active_monthly_snapshot','commit_monthly_snapshot','settle_device_change_request')
ORDER BY 1;
