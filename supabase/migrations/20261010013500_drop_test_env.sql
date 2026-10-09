-- إزالة بيئة الفحص التجريبية نهائياً (P-ATT-8)
DROP FUNCTION IF EXISTS public.reset_test_attendance_today(uuid);
NOTIFY pgrst, 'reload schema';
