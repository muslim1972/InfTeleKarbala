-- ==============================================================================
-- ميجريشن: تطهير الإشعارات المتسربة ودرع العزل الحديدي للمحافظات (BE-CORE-04)
-- ==============================================================================

-- 1. تنظيف الإشعارات القديمة لحسابات الاختبار المحذوفة
DELETE FROM public.system_notifications
WHERE content LIKE '%test-user%' OR title LIKE '%test%';

-- 2. تنظيف الإشعارات المتسربة تاريخياً بين المحافظات (recip.gov <> emp.gov)
DELETE FROM public.system_notifications n
WHERE n.id IN (
    SELECT n2.id
    FROM public.system_notifications n2
    JOIN public.profiles recip ON recip.id = n2.recipient_id
    LEFT JOIN public.profiles emp ON emp.id = (n2.metadata->>'employee_id')::uuid
    WHERE recip.governorate IS NOT NULL
      AND emp.governorate IS NOT NULL
      AND recip.governorate <> emp.governorate
);

-- 3. دالة ترغر الدرع الحديدي: منع أي إدراج مستقبلي يخترق عزل المحافظات
CREATE OR REPLACE FUNCTION public.core_enforce_governorate_notification_isolation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recip_gov TEXT;
  v_emp_id UUID;
  v_emp_gov TEXT;
BEGIN
  -- جلب محافظة المستلم
  SELECT governorate INTO v_recip_gov
  FROM public.profiles
  WHERE id = NEW.recipient_id;

  -- إذا لم يكن للمستلم محافظة مسجلة، يسمح به (مثل حسابات النظام المركزية)
  IF v_recip_gov IS NULL THEN
    RETURN NEW;
  END IF;

  -- استخراج معرف الموظف صاحب الإشعار إن وجد في الـ metadata
  IF NEW.metadata IS NOT NULL AND (NEW.metadata ? 'employee_id') THEN
    BEGIN
      v_emp_id := (NEW.metadata->>'employee_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_emp_id := NULL;
    END;

    IF v_emp_id IS NOT NULL THEN
      SELECT governorate INTO v_emp_gov
      FROM public.profiles
      WHERE id = v_emp_id;

      -- إذا عُرفت محافظة الموظف واختلفت عن محافظة المستلم، يُلغى الإدراج فوراً وبصمت
      IF v_emp_gov IS NOT NULL AND v_emp_gov <> v_recip_gov THEN
        RETURN NULL; -- Drop the row at PostgreSQL engine level
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. ربط الترغر بجدول system_notifications
DROP TRIGGER IF EXISTS trg_enforce_governorate_notification_isolation ON public.system_notifications;

CREATE TRIGGER trg_enforce_governorate_notification_isolation
BEFORE INSERT ON public.system_notifications
FOR EACH ROW
EXECUTE FUNCTION public.core_enforce_governorate_notification_isolation();

NOTIFY pgrst, 'reload schema';
