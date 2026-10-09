# BE-CORE-03 — الصلاحيات و RLS وعزل المحافظات

| الحقل | القيمة |
|---|---|
| الحالة | مجرود (عقد وصفي للقائم) |
| المسؤولية | الإجابة عن «من أنت؟ وما دورك؟ وما محافظتك؟» لكل طابوقة أخرى، وحماية الصفوف (RLS) |
| يعتمد عليه | كل طوابيق BE تقريباً |

## الواجهة العامة (دوال)
| الدالة | النوع | anon | ملاحظة |
|---|---|---|---|
| `is_admin()` / `is_hr_admin()` / `is_finance_admin()` / `is_media_admin()` / `is_privileged_user()` / `is_kiosk_user()` | DEFINER → boolean | نعم | مقبول: تعيد false للمجهول |
| `get_my_admin_role()` / `get_my_governorate()` | DEFINER → text | نعم | مقبول |
| `gov_display_name(text)` | invoker | نعم | نقية |
| `media_in_my_gov(uuid)` / `poll_in_my_gov(uuid)` | DEFINER | نعم | تُستخدم في سياسات RLS |

## الجداول
`field_permissions` (RLS، سياستان)، `field_user_permissions` (RLS، سياسة).

## القواعد القائمة
- **R1** الأدوار الإدارية في `profiles.admin_role`: developer، it_supervisor، general، hr، finance، media، biometric، attendance_supervisor… (`DEVELOPER_LEVEL_ROLES` = developer، it_supervisor يتجاوزان عزل المحافظة).
- **R2** عزل المحافظة: غير المطوّر لا يرى/يعدّل إلا صفوف `governorate` محافظته.
- **R4** الدوال الإدارية تمر عبر `core_require_role(roles[])`: `role='admin'` وحده لا يكفي (كل المدراء role=admin) — المعيار `admin_role`.
- **R3** كل دالة `SECURITY DEFINER` تُعدّل بيانات يجب أن: (أ) لا تُمنح لـ anon إلا إن كانت جزءاً من تسجيل الدخول، (ب) تتحقق داخلياً من الدور عبر `auth.uid()`.

## سجل أمني
| التاريخ | الحدث |
|---|---|
| 2026-10-09 | **ثغرة حرجة مُغلقة (المرحلة 1):** 14 دالة DEFINER كانت قابلة للتنفيذ من anon عبر النطاق العام `khr-itpc.egov.iq`، منها `rpc_sync_user_auth` (تغيير كلمة سر أي حساب). سُحب anon (هجرة `20261009223700_core03_revoke_anon_sensitive_rpcs.sql`). تحقق: anon ⇒ 401، `get_server_time` ⇒ 200. |
| 2026-10-09 | **المرحلة 2 مُغلقة:** أغلفة فحص دور (`core_require_role`) لـ rpc_sync_user_auth، rpc_delete_user_robust، اللقطات الشهرية الأربع، clone_departments_tree، settle_device_change_request (صار يفرض `auth.uid()` بدل p_admin_id المرسل من العميل)، append_deleted_by (لصاحب الحساب فقط). الأصلية صارت `*__impl` مغلقة. منع تعديل/حذف حساب مطوّر من غير مطوّر، ومنع عبور المحافظة. هجرة `20261009230000_core03_role_guards_admin_rpcs.sql`. اختُبر: موظف عادي⇒forbidden، استدعاء __impl مباشرة⇒permission denied، مطوّر⇒نجاح، مالية⇒لا تنسخ الأقسام. |
| 2026-10-09 | **المرحلة 3 مُغلقة:** سحب anon من كل دالة DEFINER لا تلزم قبل الدخول (≈48 دالة)؛ القائمة المسموحة موثّقة في هجرة `20261009231000_core03_revoke_anon_read_rpcs.sql`. اختبار REST من الإنترنت: get_server_time/check_user_exists⇒200، get_available_profiles/rpc_sync_user_auth/delete_monthly_snapshot⇒401. |
| ~~مفتوح~~ | ~~**المرحلة 2:** نفس الدوال ما زالت متاحة لأي موظف مسجّل (authenticated) بلا فحص دور داخلي — `rpc_sync_user_auth`، `rpc_delete_user_robust`، `delete/activate/commit_monthly_snapshot`، `clone_departments_tree`، `settle_device_change_request`. يلزم إضافة فحص دور داخل كل منها. |
| ~~مفتوح~~ | ~~مراجعة دوال القراءة المكشوفة لـ anon (`get_available_profiles`، `search_available_profiles`، `get_basic_profiles`، `get_managed_employees`، `kiosk_get_employees`، `get_promotion_users`…) — قد تسرّب بيانات موظفين للمجهول. |
| مفتوح | امتداد `pageinspect` في public (P6). |

## اختبارات العقد
| # | السيناريو | المتوقع | يغطي |
|---|---|---|---|
| T1 | anon يستدعي `rpc_sync_user_auth` | 401 | R3 |
| T2 | anon يستدعي `get_server_time` | 200 | R3 |
| T3 | موظف عادي يستدعي `rpc_sync_user_auth` | رفض (بعد المرحلة 2) | R3 |
| T4 | مشرف محافظة يقرأ ملف موظف محافظة أخرى | رفض | R2 |
| T5 | developer يقرأ أي محافظة | سماح | R1 |
| T6 | مدير مالية يستدعي clone_departments_tree | forbidden | R4 |
| T7 | موظف عادي يستدعي rpc_sync_user_auth__impl مباشرة | permission denied | R4 |
