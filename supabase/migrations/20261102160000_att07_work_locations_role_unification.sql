-- ==============================================================================
-- BE-ATT-07: توحيد صلاحيات إدارة مواقع العمل + سحب منح anon الخام
-- الأنوية المعمارية: BE-ATT-07 (work_locations / work_location_employees)
-- الأنوية المساعدة: BE-CORE-03 (دوال فحص الدور)
-- التاريخ: 2026-11-02
-- المرجع: مجلس المداولة الخماسية — قرار D41 + D42
-- ==============================================================================
--
-- الخلفية (تدقيق حي على الإنتاج 2026-11-02):
--   1) واجهة AttendanceAdminSettings.tsx تُتاح لمَن:
--        isDeveloperLevel(admin_role)  -> developer | it_supervisor
--        admin_role='general' | 'biometric' | 'attendance_supervisor'
--        has_attendance_access = true | username='attend'
--      بينما سياسة الكتابة على work_locations تشترط is_admin() وهو:
--        role='admin' فقط
--      فأي حساب يحمل admin_role إدارياً مع role='user' (يوجد فعلاً:
--      admin_role='developer' + role='user') يمرّ من الواجهة ويصطدم بـ 403 صامت.
--
--   2) تباين داخل نفس العملية: work_location_employees تسمح بـ 'biometric'
--      صراحةً، بينما work_locations لا تسمح. مصدران للحقيقة.
--
--   3) منح خام (GRANT) لـ anon على الجدولين: INSERT+SELECT+UPDATE+DELETE.
--      RLS يحجب حالياً، لكن الاعتماد على سياسة RLS دون سحب المنح يعني خط دفاع أحادي.
--
-- قرار النطاق: لا نلمس is_admin() لأنها underpin لـ 42 سياسة على 25+ جدول
--   (financial_records, profiles_delete_policy, yearly_records, leave_history...).
--   توسيعها عالمياً يمنح مشرف البصمة كتابة على السجلات المالية.
--   الحل: دالة فحص دور مخصّصة لنطاق مواقع العمل فقط.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. دالة فحص الدور لنطاق مواقع العمل (BE-CORE-03 نطاق عام، مستهلَك من BE-ATT-07)
-- ------------------------------------------------------------------------------
-- تعيد true إذا كان صاحب الجلسة يملك أحد أدوار إدارة مواقع العمل المعتمدة،
-- مع احترام قاعدة R4 في عقد BE-CORE-03: المعيار admin_role لا role='admin' وحده.
-- ملاحظة أمنية: تعيد false للمجهول (auth.uid() IS NULL) — لا ترمي استثناء،
--   لأن استخدامها داخل سياسات RLS-х تحتاج قيمة منطقية لا خطأ.

CREATE OR REPLACE FUNCTION public.can_manage_work_locations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        admin_role = ANY (ARRAY['developer','it_supervisor','general','biometric','attendance_supervisor'])
        OR role = 'admin'
      )
  );
$$;

COMMENT ON FUNCTION public.can_manage_work_locations() IS
  'يفحص ما إذا كان صاحب الجلسة يملك دوراً إدارياً مخوّلاً بإدارة مواقع العمل (BE-ATT-07). معيار المعيار: admin_role مع إبقاء role=admin شاملاً للأدوار القديمة. تعيد false للمجهول.';

-- ------------------------------------------------------------------------------
-- 2. إعادة بناء سياسات work_locations على الفحص المخصّص
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS work_locations_insert_admin_my_gov ON public.work_locations;
DROP POLICY IF EXISTS work_locations_update_admin_my_gov ON public.work_locations;
DROP POLICY IF EXISTS work_locations_delete_admin_my_gov ON public.work_locations;
DROP POLICY IF EXISTS work_locations_select_my_gov       ON public.work_locations;

-- القراءة: كل مسجّل يرى مواقع محافظته فقط (دون تغيير — كانت تعتمد على
-- get_my_governorate() وهي غير مثبّتة search_path؛ نثبّت في أعلاه).
CREATE POLICY work_locations_select_my_gov
ON public.work_locations
FOR SELECT
TO authenticated
USING (governorate = public.get_my_governorate());

-- الإضافة: صاحب دور معتمد + المحافظة النشطة فقط
CREATE POLICY work_locations_insert_admin_my_gov
ON public.work_locations
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_work_locations()
  AND governorate = public.get_my_governorate()
);

-- التعديل: صاحب دور معتمد، مع منع المساس بمحافظات أخرى
CREATE POLICY work_locations_update_admin_my_gov
ON public.work_locations
FOR UPDATE
TO authenticated
USING (
  public.can_manage_work_locations()
  AND governorate = public.get_my_governorate()
)
WITH CHECK (
  public.can_manage_work_locations()
  AND governorate = public.get_my_governorate()
);

-- الحذف: صاحب دور معتمد +محافظة النشطة فقط
CREATE POLICY work_locations_delete_admin_my_gov
ON public.work_locations
FOR DELETE
TO authenticated
USING (
  public.can_manage_work_locations()
  AND governorate = public.get_my_governorate()
);

-- ------------------------------------------------------------------------------
-- 3. توحيد work_location_employees مع نفس دالة الفحص (إزالة التباين)
-- ------------------------------------------------------------------------------
-- كان: 'developer'|'general'|'biometric' داخل EXISTS مباشر + شرط role='admin'.
-- نوحّد المعيار مع work_locations ليصبح مصدر الحقيقة واحداً.

DROP POLICY IF EXISTS "Admins can manage work_location_employees" ON public.work_location_employees;
DROP POLICY IF EXISTS "Admins can manage all location assignments"  ON public.work_location_employees;

CREATE POLICY "Admins can manage work_location_employees"
ON public.work_location_employees
FOR ALL
TO authenticated
USING (public.can_manage_work_locations())
WITH CHECK (public.can_manage_work_locations());

-- ------------------------------------------------------------------------------
-- 4. سحب المنح الخام من anon (D42) — RLS يبقى خط الدفاع الوحيد/الرئيسي
-- ------------------------------------------------------------------------------
-- ملاحظة: SELECT على work_locations لا يزال مطلوباً لواجهات ما قبل الدخول؟
--   فحصProduction: لا توجد سياسة SELECT لـ anon على work_locations إطلاقاً،
--   وسحب الـ grant لا يغيّر السلوك الوظيفي (anon ممنوع أصلاً)، لكنه يزيل
--   الاعتماد على policy وحدها.

REVOKE ALL ON public.work_locations           FROM anon;
REVOKE ALL ON public.work_location_employees FROM anon;

-- ------------------------------------------------------------------------------
-- 5. تثبيت search_path لدالة get_my_governorate() (BE-CORE-03 — تفاوت دفاعي)
-- ------------------------------------------------------------------------------
-- كانت SECURITY DEFINER بلا SET search_path، خلافاً لـ is_admin() وcore_require_role().

CREATE OR REPLACE FUNCTION public.get_my_governorate()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT governorate FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 6. سجل تدقيق لتعديلات مواقع العمل (BE-ATT-07)
-- ------------------------------------------------------------------------------
-- يلتقط أي كتابة على work_locations: من، ماذا، متى. جدول مستقل بسيط
-- يُكتب عبر trigger على الجدول نفسه (لا تعديل على مستوى الأنوية الأخرى).

CREATE TABLE IF NOT EXISTS public.work_location_audit_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid REFERENCES public.work_locations(id) ON DELETE CASCADE,
    action      text NOT NULL,
    actor_id    uuid,
    actor_name  text,
    actor_role  text,
    governorate text,
    details     jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.work_location_audit_logs IS
  'سجل تدقيق تعديلات مواقع العمل (BE-ATT-07). يكتبه trigger على work_locations.';

ALTER TABLE public.work_location_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_location_audit_logs_admin_select ON public.work_location_audit_logs;
CREATE POLICY work_location_audit_logs_admin_select
ON public.work_location_audit_logs
FOR SELECT
TO authenticated
USING (public.can_manage_work_locations());

REVOKE ALL ON public.work_location_audit_logs FROM anon;

CREATE OR REPLACE FUNCTION public.work_locations_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_actor     uuid;
    v_actor_name text;
    v_actor_role text;
    v_gov       text;
    v_action    text;
BEGIN
    v_actor := auth.uid();
    SELECT full_name, admin_role, governorate
      INTO v_actor_name, v_actor_role, v_gov
      FROM public.profiles WHERE id = v_actor;

    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        INSERT INTO public.work_location_audit_logs
            (location_id, action, actor_id, actor_name, actor_role, governorate, details)
        VALUES (NEW.id, v_action, v_actor, v_actor_name, v_actor_role,
                NEW.governorate, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        INSERT INTO public.work_location_audit_logs
            (location_id, action, actor_id, actor_name, actor_role, governorate, details)
        VALUES (NEW.id, v_action, v_actor, v_actor_name, v_actor_role,
                NEW.governorate,
                jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        INSERT INTO public.work_location_audit_logs
            (location_id, action, actor_id, actor_name, actor_role, governorate, details)
        VALUES (OLD.id, v_action, v_actor, v_actor_name, v_actor_role,
                OLD.governorate, to_jsonb(OLD));
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_locations_audit ON public.work_locations;
CREATE TRIGGER trg_work_locations_audit
AFTER INSERT OR UPDATE OR DELETE ON public.work_locations
FOR EACH ROW EXECUTE FUNCTION public.work_locations_audit_trigger();

-- ------------------------------------------------------------------------------
-- 7. تسجيل النواة المعمارية في سجل الحارس
-- ------------------------------------------------------------------------------
-- (يُحدَّث registry.json على مستوى المستودع — أدناه الدوال/الجداول الجديدة)

NOTIFY pgrst, 'reload schema';
