-- BE-CORE-03 / المرحلة الأمنية الثانية (تحصين دوال الموارد البشرية والإشعارات والتخزين)
-- الهدف: سحب صلاحية EXECUTE من PUBLIC و anon عن 21 دالة إدارية ودوال استمرارية وإشعارات
-- ومنحها حصراً للمستخدمين المسجلين (authenticated) و (service_role)
-- إضافة إلى حظر سرد وتصفح لقطات البصمة وملفات المحادثات للمستخدم المجهول (anon)

-- 1. سحب صلاحيات التنفيذ من anon و PUBLIC
REVOKE EXECUTE ON FUNCTION public.admin_create_kiosk_device(text, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_kiosk_device(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_continuity_by_finance(uuid, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_training_student(text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_visitors_by_range(date, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats_v1(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_requests_tab_all_status(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_service_continuity_request_for_print(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unspecified_gender_profiles(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_continuity_printed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_service_continuity_hr_issue(uuid, text, text, date, text, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_service_continuity_supervisor(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_continuity_by_finance(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rename_monthly_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_shift_absence_or_penalty(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_substitute_request(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_available_profiles(text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_service_continuity_request(text, boolean, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_requests_tab_all(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_and_approve_continuity_by_finance(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_and_approve_continuity_by_finance(uuid, text, text, text, text[]) FROM PUBLIC, anon;

-- 2. تثبيت الصلاحية حصراً للمستخدم المصادق عليه (authenticated) وسيرفس رول
GRANT EXECUTE ON FUNCTION public.admin_create_kiosk_device(text, uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_kiosk_device(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_continuity_by_finance(uuid, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_training_student(text, text, text, text, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_visitors_by_range(date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_stats_v1(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_requests_tab_all_status(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_service_continuity_request_for_print(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unspecified_gender_profiles(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_continuity_printed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_service_continuity_hr_issue(uuid, text, text, date, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_service_continuity_supervisor(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_continuity_by_finance(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rename_monthly_snapshot(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_shift_absence_or_penalty(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_substitute_request(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_available_profiles(text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_service_continuity_request(text, boolean, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_requests_tab_all(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_and_approve_continuity_by_finance(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_and_approve_continuity_by_finance(uuid, text, text, text, text[]) TO authenticated, service_role;

-- 3. تحصين حاويات التخزين: منع السرد والتصفح المجهول (Block Anonymous Directory Listing)
-- استبدال سياسة القراءة العامة المفتوحة بسياسة مقيدة للمستخدمين المسجلين فقط
DROP POLICY IF EXISTS "Public Access Attendance Snapshots" ON storage.objects;
CREATE POLICY "Authenticated Read Attendance Snapshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attendance-snapshots');

DROP POLICY IF EXISTS "Public Access for chat-files" ON storage.objects;
CREATE POLICY "Authenticated Read chat-files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files');

-- 4. تحديث كاش واجهة PostgREST
NOTIFY pgrst, 'reload schema';
