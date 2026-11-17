-- BE-CORE-03 / المرحلة الأمنية الأولى (عزل التريغرات الداخلية عن PostgREST)
-- الهدف: سحب صلاحية EXECUTE من PUBLIC و anon عن 25 دالة تريغر ومزامنة داخلية
-- هذه الدوال تعمل تلقائياً عبر مشغلات PostgreSQL (Triggers) على الجداول
-- ولا يستدعيها تطبيق الواجهة إطلاقاً كـ RPC.
-- سحب الإذن يمنع استدعاءها من خارج السيرفر عبر HTTP API دون أي مساس بعمل التريغرات.

REVOKE EXECUTE ON FUNCTION public.cleanup_request_notifications_on_process() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.core_enforce_governorate_notification_isolation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_hash_summer_password() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_sync_profile_dept_texts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_sync_profile_password_to_auth() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_leave_state_machine() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_device_enrollment_changes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_field_changes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_leave_insert_history() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_table_activity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_department_insert_ensure_location() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.on_device_change_request_settled() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_available_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_department_manager_to_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_dept_manager_assignment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_printer_operator_flags() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_dept_to_work_location() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_to_work_location_and_manager() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_work_location_emp_to_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_work_location_on_dept_rename() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_work_location_to_profile_dept() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_work_locations_on_department_rename() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_accumulate_time_off() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_yearly_records_counts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.work_locations_audit_trigger() FROM PUBLIC, anon;

-- تحديث كاش واجهة برمجة تطبيقات PostgREST
NOTIFY pgrst, 'reload schema';
