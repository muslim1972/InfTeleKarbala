# FE-CORE-01..05 — نواة الواجهة

## FE-CORE-01 Shell / Router
- **الملفات:** `main.tsx`، `App.tsx` (lazy لكل صفحة)، `components/layout/*`، `ErrorBoundary`، `NotFound`.
- **المسارات:** `/` و`/login` → AppContent، `/requests`، `/requests/leave`، `/chat/:id`، `/kiosk`، `/*` → NotFound.
- **R1** كل صفحة/ميزة تُحمّل بـ `lazy()` (تقسيم الحزم).
- **R2** كل مسار محمي يمر بـ `ProtectedRoute`.

## FE-CORE-02 Auth
- **الواجهة:** `AuthProvider`، `useAuth()`، `AppUser`.
- **يستدعي:** `get_login_profile`، `get_own_profile`، `update_rate_limit`، `secure_change_password`، `rpc_handle_forgot_password`، إدراج `login_logs`، رفع `avatar-images`.
- **R1** المستخدم الحالي يُقرأ من `get_own_profile` فقط.
- ⚠ تشابك: يرفع الصورة الشخصية (مسؤولية FE-HR-01).

## FE-CORE-03 Theme / Governorate / Settings / Accessibility
- **الواجهة:** `ThemeProvider/useTheme`، `GovernorateProvider/useGovernorate` (يقرأ `governorate_cards`)، `SettingsModal`، `AccessibilityContext`.

## FE-CORE-04 عميل Supabase والأخطاء والكاش
- **الواجهة:** `supabase` (عميل وحيد)، `logSystemError()` → `system_error_logs`، `cacheManager`، أدوات تنسيق التاريخ والأرقام والعربية.
- **R1** لا يُنشأ عميل Supabase ثانٍ في أي مكان.

## FE-CORE-05 واجهة الإشعارات
- **الواجهة:** `NotificationsBell`، `NotificationHistoryModal`، `AppNotifications`، `services/notifications` (`sendPushNotification`، OneSignal).
- ⚠ تشابك: `NotificationsBell` يقرأ `meeting_participants` مباشرة (مجال COM) — يُنقل لواجهة COM.

## اختبارات العقد (Vitest — تُضاف في M2)
| # | السيناريو | المتوقع | يغطي |
|---|---|---|---|
| T1 | فحص ثابت: كل import لصفحة في App.tsx عبر lazy | نعم | FE-CORE-01 R1 |
| T2 | فحص ثابت: `createClient` يظهر في ملف واحد فقط | نعم | FE-CORE-04 R1 |
| T3 | فحص ثابت: كل `<Route>` غير عام ملفوف بـ ProtectedRoute | نعم | FE-CORE-01 R2 |
