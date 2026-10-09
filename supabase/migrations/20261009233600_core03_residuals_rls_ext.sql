-- BE-CORE-03 / إصلاح أمني — المرحلة 4 (2026-10-09): البقايا
-- يُنفَّذ بـ supabase_admin، و**بعد** نشر الواجهة التي لا تطلب password_hash.

BEGIN;

-- P6: امتداد pageinspect (قراءة صفحات التخزين الخام) — غير مستخدم
DROP EXTENSION IF EXISTS pageinspect;

-- P11: دوال تشخيص/اختبار غير مستخدمة في الكود
DROP FUNCTION IF EXISTS public.debug_modify_check(uuid);
DROP FUNCTION IF EXISTS public.reset_test_attendance(uuid, uuid);

-- RLS-1: الإشعارات — كان أي مجهول يستطيع إدراج إشعار لأي موظف (تصيّد)
DROP POLICY IF EXISTS "System can insert notifications" ON public.system_notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.system_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS-2: طلبات تغيير الجهاز — كان المجهول يستطيع الإدراج
DROP POLICY IF EXISTS device_change_requests_insert ON public.device_change_requests;
CREATE POLICY device_change_requests_insert ON public.device_change_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);

-- RLS-3: نتائج الترفيع كانت مقروءة لأي مجهول
DROP POLICY IF EXISTS "Anyone can read promotion results" ON public.promotion_results;
CREATE POLICY "Authenticated can read promotion results" ON public.promotion_results
  FOR SELECT TO authenticated USING (true);

-- RLS-4: هاش كلمات سر المتدربين كان مقروءاً لأي مجهول — حجب العمود
REVOKE SELECT ON public.summer_training_students FROM anon, authenticated;
GRANT SELECT (id, full_name, username, institution_name, exam_grade, supervisor_id, created_at, training_location, trainer_name, batch_name)
  ON public.summer_training_students TO anon, authenticated;

-- امتيازات لا يحتاجها PostgREST إطلاقاً (TRUNCATE يتجاوز RLS)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
