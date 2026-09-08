-- ============================================================
-- الحل النهائي: بطاقة "قسم تجهيز خدمات المعلوماتية" في الترحيب
-- السبب: سياسة "Strict departments read" تسمح بالقراءة فقط لـ
--        general/developer/hr، ومنتسبي القسم admin_role=NULL
--        فيرون 0 صفوف من departments فتبقى hasCapacities=false.
-- الحل:  السماح لكل مستخدم مُصادَق بقراءة قسمه هو فقط، مع إبقاء
--        القراءة الكاملة والإدارة محصورة بالإدارات كما هي.
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS "Strict departments read" ON public.departments;

CREATE POLICY "Read own department or admins"
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_admin_role() IN ('general','developer','hr')
    OR id = (SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid())
  );

COMMIT;

-- تحقق: السياسات بعد التغيير
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'departments';
