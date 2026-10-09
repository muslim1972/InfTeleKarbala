# BE-CORE-01 · 04 · 05 · 06 — النواة المساندة

## BE-CORE-01 الوقت
- **الواجهة:** `get_server_time() → jsonb` (DEFINER، anon مسموح — لازم قبل الدخول لمنع التلاعب بساعة الهاتف).
- **R1** كل حكم زمني (بصمة، تأخير، إغلاق يوم) يعتمد وقت الخادم بتوقيت `Asia/Baghdad`، لا ساعة الجهاز.
- **T1** الاستدعاء يعيد وقتاً يختلف عن `now()` بأقل من ثانية — يغطي R1.

## BE-CORE-04 الإشعارات
- **الجدول:** `system_notifications(id, recipient_id, sender_id, type, title, content, is_read, created_at, metadata)` — RLS، 3 سياسات.
- **Edge:** `send-notification` (Push عبر OneSignal/ntfy `hr-ntfy`).
- **R1** كل إشعار له مستلم واحد (`recipient_id`)؛ الإرسال لعدة مستلمين = صفوف متعددة.
- **R2** المستخدم يرى ويعلّم إشعاراته فقط.
- **R3** ⚠ لا توجد دالة مركزية للإرسال: كل مجال يُدرج مباشرة (حضور، إجازات، أجهزة…) ⇒ تكرار منطق تحديد المشرفين. **مقترح:** `notify(recipients[], type, title, content, metadata)` + `resolve_supervisors(emp, kind)` كواجهة وحيدة.
- **T1** موظف يقرأ إشعارات غيره ⇒ 0 صف — R2. **T2** إشعار لثلاثة ⇒ 3 صفوف — R1.

## BE-CORE-05 التدقيق والسجلات
- **دوال:** `log_field_changes`، `log_table_activity` (مشغلات)، `append_deleted_by` (حذف رسالة لمستخدم — مكانها الصحيح BE-COM-01)، `debug_modify_check` (⚠ تشخيص في الإنتاج، سُحب تنفيذه 2026-10-09).
- **الجداول:** `activity_logs`، `field_change_logs`، `system_error_logs`، `v_actor_name`.
- **المشغلات:** audit على profiles، financial_records، leave_requests، yearly_records، committees/thanks_details، webauthn_credentials.
- **R1** كل تعديل على جدول حساس يُسجَّل (من، متى، القيمة القديمة/الجديدة).
- **T1** تعديل حقل في profiles ⇒ سطر في field_change_logs — R1.

## BE-CORE-06 الأقسام والمحافظات
- **دوال:** `clone_departments_tree(gov)` (ينسخ شجرة كربلاء لمحافظة جديدة)، `get_departments_bypass_rls()`، `enable_governorate_card(gov)`، `ensure_work_locations_for_governorate(gov)`، مشغلا `on_department_insert_ensure_location` و`sync_work_locations_on_department_rename` (⚠ يكتبان في جداول BE-ATT-07 مباشرة — تشابك مسجّل).
- **الجداول:** `departments(id, name, level, parent_id, manager_id, governorate…)`، `governorate_cards`.
- **R1** القسم شجرة (`parent_id`)، ومدير القسم `manager_id` هو مستلم إشعارات موظفيه.
- **R2** إنشاء/تسمية قسم يُنشئ/يُحدّث موقع عمل مطابقاً.
- **T1** إنشاء قسم ⇒ موقع عمل جديد — R2. **T2** موظف بلا مدير مباشر ⇒ يُصعد للأب — R1.
