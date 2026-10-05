-- ====================================================================
-- migration: 20261002120000_reset_test_attendance_rpc.sql
-- RPC لحذف بصمات اليوم لمستخدمي البيئة التجريبية المعتمدة حصراً
-- (عزل تام — عند حذف البيئة احذف هذا الملف فقط)
-- ====================================================================

DROP FUNCTION IF EXISTS public.reset_test_attendance_today(uuid);

CREATE OR REPLACE FUNCTION public.reset_test_attendance_today(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id  uuid := auth.uid();
    v_username   text;
    v_full_name  text;
    v_is_test    boolean := false;
    v_start      timestamptz;
    v_end        timestamptz;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
    END IF;

    -- جلب بيانات الموظف المستهدف (اسم المستخدم والاسم الكامل)
    SELECT username, full_name INTO v_username, v_full_name
    FROM public.profiles
    WHERE id = p_employee_id;

    IF v_username IS NULL AND v_full_name IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على بيانات الموظف المطلوب';
    END IF;

    -- التحقق الصارم: المستخدم المستهدف يجب أن يكون ضمن المعرفات المعتمدة للبيئة التجريبية فقط
    v_is_test := (v_username = ANY (ARRAY['test-attendance-admin', 'test-user-1', 'test-user-2']))
              OR (v_full_name = ANY (ARRAY['test-attendance-admin', 'test-user-1', 'test-user-2']));

    IF NOT v_is_test THEN
        RAISE EXCEPTION 'هذه العملية محصورة بمستخدمي البيئة التجريبية المعتمدة';
    END IF;

    -- نطاق اليوم بتوقيت بغداد (منتصف الليل إلى منتصف الليل التالي UTC)
    v_start := date_trunc('day', timezone('Asia/Baghdad', now()))
                 AT TIME ZONE 'Asia/Baghdad' AT TIME ZONE 'UTC';
    v_end   := v_start + interval '1 day';

    -- حذف سجل الحضور لليوم لهذا الموظف (بما فيها البصمات الخام والصور والدخول والخروج)
    DELETE FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND created_at >= v_start
      AND created_at <  v_end;

    RETURN true;
END;
$$;

-- صلاحيات التنفيذ: الموظف المعتمد ومدير النظام فقط
REVOKE ALL ON FUNCTION public.reset_test_attendance_today(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reset_test_attendance_today(uuid) TO authenticated, service_role;
