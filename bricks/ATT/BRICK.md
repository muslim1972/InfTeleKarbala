# عقد نطاق الحضور — ATT (وصفي، يصف الواقع الحالي لا المنشود)

> الحالة: **مسودة للمراجعة والتوقيع**. لا تعديل منطق قبل توقيع المستخدم (D-قاعدة العقود).
> يغطي: BE-ATT-01, BE-ATT-02, BE-ATT-05, BE-ATT-06, BE-ATT-07, FE-ATT-01, FE-ATT-02.
> محرك الخفارات BE-ATT-04 له عقده: `bricks/ATT-04-roster-engine/BRICK.md`.
> ملاحظة: لا توجد طابوقة BE-ATT-03 في السجل — الرقم محجوز لـ«محرك الدوام الثابت/الخصومات» الموحّد (M3).

## 1. المسؤوليات
| الطابوقة | المسؤولية |
|---|---|
| BE-ATT-01 | تعريف جداول الدوام (`work_schedules`, `work_schedule_days`) |
| BE-ATT-02 | تسجيل البصمة وحفظها (`submit_attendance_record_secure`) + الإعدادات والاستثناءات |
| BE-ATT-05 | إغلاق اليوم السابق والبصمات الافتراضية (`closeout_prev_day_attendance`) |
| BE-ATT-06 | الأجهزة/البصمة الحيوية/WebAuthn/الكشك وطلبات تغيير الجهاز |
| BE-ATT-07 | مواقع العمل (geofence) والعطل الرسمية |
| FE-ATT-01 | واجهة الحضور: `src/features/attendance` + `src/lib/attendanceHelpers.ts` |
| FE-ATT-02 | واجهة الكشك: `src/features/kiosk` |

## 2. الواجهة العامة (Public API)
- RPC: `submit_attendance_record_secure(emp, record_id, updates)`، `closeout_prev_day_attendance(emp, followup)`، `roster_evaluate_me()`، دوال الكشك `kiosk_activate`/`kiosk_device_check` (anon — ضمن allowlist ما قبل الدخول)، `kiosk_get_employees`، `admin_*kiosk*` (admin_role)، `submit_device_change_request`، `settle_device_change_request` (يفرض `auth.uid()`).
- FE: `registerPunch` و`enforceMandatoryPenalties` في `attendanceService.ts`؛ خدمات: `attendanceCalc`, `punchCategorizer`, `shiftRules`, `timesheetStatusHelper`, `serverTimeService`, `webauthnService`, `geofenceService`, `workLocationService`, `rosterReminderService`, `snapshotStorage`, `leaveIntegrationService`.

## 3. القواعد (R#) — كما هي الآن
| R# | القاعدة |
|---|---|
| R1 | البصمة تُحفظ عبر `submit_attendance_record_secure` (تحقق الهوية في DB) |
| R2 | الوقت المرجعي وقت الخادم (`serverTimeService`) لا وقت الجهاز |
| R3 | الدوام الثابت: سماح 08:00–08:30 دخولاً و14:30–15:00 خروجاً |
| R4 | موظف الخفارة بلا سماح؛ يُوجَّه إلى `roster_evaluate_me` (عقد ATT-04) |
| R5 | إغلاق اليوم السابق يُنشئ بصمة افتراضية/عقوبة لليوم غير المكتمل |
| R6 | البصمة ضمن نطاق موقع العمل (geofence) ما لم يُستثنَ الموظف |
| R7 | جهاز واحد معتمد لكل موظف؛ التغيير بطلب يوافق عليه مسؤول |
| R8 | الكشك يعمل فقط بجهاز مفعّل نشط (`kiosk_device_check`) |
| R9 | رفع لقطة البصمة لا يحجب التسجيل (سقف 8 ث) |
| R10 | يوم العطلة الرسمية لا يُحتسب غياباً |

## 4. الاختبارات (T#) — مخطط M2
| T# | يغطي | الاختبار |
|---|---|---|
| T1 | R1 | anon لا يستطيع استدعاء `submit_attendance_record_secure`؛ مستخدم لا يكتب لغيره |
| T2 | R3 | دخول 08:29 = بلا تأخير، 08:31 = تأخير (ثابت) |
| T3 | R4 | موظف خفارة لا يمر عبر مسار السماح في العميل |
| T4 | R5 | يوم بلا خروج يُغلق ببصمة افتراضية مرة واحدة فقط (idempotent) |
| T5 | R6 | بصمة خارج النطاق تُرفض |
| T6 | R7 | `settle_device_change_request` يرفض غير admin_role |
| T7 | R8 | كشك غير نشط يُرفض |
| T8 | R9 | فشل رفع اللقطة لا يُفشل البصمة |
| T9 | R10 | عطلة رسمية لا تولّد غياباً |
| T10 | R2 | فحص ثابت: لا `new Date()` في قرار التأخير بالخدمات |

## 5. التشابكات والمشكلات المعروفة (مصدر خطة M3)
- **P-ATT-1 تكرار المنطق في 3 أماكن+1:** العميل (`enforceMandatoryPenalties`+`registerPunch`، 82KB) ↔ `closeout_prev_day_attendance` ↔ `submit_attendance_record_secure` ↔ محرك الخفارات. القرار المنشود: منطق القرار في DB فقط.
- **P-ATT-2 ثلاثة مصادر للسماح:** `attendance_settings.grace_period_mins`، `work_schedules.grace_period_minutes`، و30 مكتوبة صلباً. يجب مصدر واحد.
- **P-ATT-3 دالة ميتة محتملة:** `process_daily_attendance()` بلا مستدعٍ ولا cron — تُتحقق ثم تُحذف بقرار.
- **P-ATT-4 وصول مباشر للجدول:** `attendance_records` يُقرأ/يُكتب مباشرة من 7 ملفات (`AttendanceAdminSettings`×4، `attendanceService`×9، `FaceEnrollment`، `useLiveAttendance`، `attendanceRequestEngine`، `timesheetService`، `attendanceHelpers`) — يكسر العزل.
- **P-ATT-5:** `registerPunch` يُستدعى من 3 مداخل (`AttendanceCheckInOut`, `useAttendance`, `KioskCapture`).
- **P-ATT-6:** مشغّلات الأقسام تكتب في `work_locations` (تشابك مع HR/CORE).
- **P-ATT-7:** لا دالة إشعار مركزية؛ كل نطاق يحدد المسؤولين بنفسه.
- **P-ATT-8 (مُغلقة 2026-10-10):** أُزيلت بيئة الفحص التجريبية كلياً: حُذف `testEnvironment.ts` وكل تجاوزاته (السياج الجغرافي، مهلة الأمان، حظر الجهاز غير المعتمد، قيود طلبات الإجازة) من `AttendanceCheckInOut.tsx` و`TimeOffRequestForm.tsx`، مع هجرة `20261010013500_drop_test_env.sql` (DROP `reset_test_attendance_today`).
- **P-ATT-9:** خطأ تسمية متأخر/مبكر (مذكور سابقاً) — يُعالج في M3.
