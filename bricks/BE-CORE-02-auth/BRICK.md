# BE-CORE-02 — الهوية والمصادقة

| الحقل | القيمة |
|---|---|
| الحالة | مجرود |
| المسؤولية | تسجيل الدخول، كلمات السر، 2FA، مزامنة `profiles` ↔ `auth.users`، تحديد المعدل |
| يعتمد على | BE-CORE-03، BE-HR-01 (profiles) |

## الواجهة العامة
| الدالة | anon | الاستخدام |
|---|---|---|
| `get_login_profile(username, password)` | نعم (لازم) | AuthContext — الدخول |
| `authenticate_user(job_number, password)` | نعم (لازم) | دخول قديم |
| `check_rate_limit` / `update_rate_limit` | نعم (لازم) | AuthContext — منع التخمين |
| `rpc_handle_forgot_password(username, confirm)` | نعم (لازم) | نسيان كلمة السر ← إشعار المسؤول |
| `secure_change_password(new)` | authenticated | يغيّر كلمة سر المستخدم نفسه |
| `change_password(user, old, new)` | عبر Edge `auth-change-password` | |
| `rpc_sync_user_auth(user, email, pw)` | authenticated (كان anon حتى 2026-10-09) | useEmployeeManager — إداري |
| `rpc_delete_user_robust(user)` | authenticated | useEmployeeManager — إداري |
| `hash_password` / `verify_password` | نعم | ⚠ يجب ألا تكون مكشوفة لـ anon (مراجعة) |
| `check_user_exists` / `check_employee_exists_global` | نعم | ⚠ تسمح بتعداد أسماء المستخدمين (مراجعة) |
| مشغل `fn_sync_profile_password_to_auth` | — | profiles → auth.users |

Edge: `auth-login`، `auth-change-password`، `auth-verify-2fa`، `send-2fa-email`، `admin-sync-auth`، `bulk-create-users`.
الجداول: `login_logs`، `rate_limits`، `api_rate_limits`، `_encryption_keys`، `_internal_keys` (RLS مفعّل بلا سياسات = مغلقة للعميل ✓).

## القواعد القائمة
- **R1** الدخول باسم المستخدم + كلمة السر عبر `get_login_profile` ثم جلسة Supabase Auth.
- **R2** تحديد المعدل لكل (معرّف، نقطة نهاية) قبل وبعد المحاولة.
- **R3** كلمة السر تُخزّن مشفّرة bcrypt (`crypt` + `gen_salt('bf')`).
- **R4** تعديل كلمة سر/حذف حساب موظف آخر: للأدوار الإدارية فقط (⚠ غير مُطبّق داخل DB بعد — انظر BE-CORE-03 المرحلة 2).

## اختبارات العقد
| # | السيناريو | المتوقع | يغطي |
|---|---|---|---|
| T1 | دخول صحيح | جلسة + سطر login_logs | R1 |
| T2 | 10 محاولات خاطئة | حظر مؤقت | R2 |
| T3 | فحص `encrypted_password` يبدأ بـ `$2` | نعم | R3 |
| T4 | موظف عادي يستدعي `rpc_sync_user_auth` لغيره | رفض | R4 |
