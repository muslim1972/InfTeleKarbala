-- ==============================================================================
-- ترقية طلبات الاستمرارية: دعم تبديل تضمين الراتب للمسؤول + إرجاع أدنى تشكيل إداري للطباعة
-- المسار: supabase/migrations/20261124163500_hr01_continuity_salary_toggle_and_print_org.sql
-- ==============================================================================

-- 1. حذف التواقيع القديمة لمنع تعارض Overloads في PostgREST
DROP FUNCTION IF EXISTS public.update_and_approve_continuity_by_finance(uuid, text, text);
DROP FUNCTION IF EXISTS public.update_and_approve_continuity_by_finance(uuid, text, text, text, text[]);

-- 2. إنشاء الدالة المحدثة بدعم معامل تبديل الراتب
CREATE OR REPLACE FUNCTION public.update_and_approve_continuity_by_finance(
    p_request_id uuid,
    p_destination_entity text,
    p_notes text DEFAULT NULL::text,
    p_cadre_type text DEFAULT 'permanent'::text,
    p_cc_recipients text[] DEFAULT NULL::text[],
    p_include_salary boolean DEFAULT NULL::boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID;
    v_nominal NUMERIC(12, 2) := 0;
    v_gross NUMERIC(12, 2) := 0;
    v_net NUMERIC(12, 2) := 0;
BEGIN
    IF p_destination_entity IS NULL OR TRIM(p_destination_entity) = '' THEN
        RAISE EXCEPTION 'يرجى تحديد الجهة المعنون إليها الكتاب';
    END IF;

    -- جلب صاحب الطلب
    SELECT user_id INTO v_user_id
    FROM public.service_continuity_requests
    WHERE id = p_request_id AND status = 'pending_finance';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الاستمرارية غير موجود أو تمت معالجته مسبقاً');
    END IF;

    -- معالجة خيار الراتب إذا تم تمريره صراحة
    IF p_include_salary IS TRUE THEN
        SELECT
            COALESCE(nominal_salary, 0),
            COALESCE(gross_salary, nominal_salary, 0),
            COALESCE(net_salary, gross_salary, nominal_salary, 0)
        INTO v_nominal, v_gross, v_net
        FROM public.financial_records
        WHERE user_id = v_user_id
        LIMIT 1;

        UPDATE public.service_continuity_requests
        SET destination_entity = TRIM(p_destination_entity),
            notes = NULLIF(TRIM(p_notes), ''),
            include_nominal_salary = TRUE,
            include_total_salary = TRUE,
            include_salary_details = TRUE,
            nominal_salary_snapshot = CASE WHEN COALESCE(nominal_salary_snapshot, 0) > 0 THEN nominal_salary_snapshot ELSE v_nominal END,
            total_salary_snapshot = CASE WHEN COALESCE(total_salary_snapshot, 0) > 0 THEN total_salary_snapshot ELSE v_gross END,
            gross_salary_snapshot = CASE WHEN COALESCE(gross_salary_snapshot, 0) > 0 THEN gross_salary_snapshot ELSE v_gross END,
            updated_at = NOW()
        WHERE id = p_request_id AND status = 'pending_finance';
    ELSIF p_include_salary IS FALSE THEN
        UPDATE public.service_continuity_requests
        SET destination_entity = TRIM(p_destination_entity),
            notes = NULLIF(TRIM(p_notes), ''),
            include_nominal_salary = FALSE,
            include_total_salary = FALSE,
            include_salary_details = FALSE,
            updated_at = NOW()
        WHERE id = p_request_id AND status = 'pending_finance';
    ELSE
        -- الإبقاء على حالة الراتب كما هي عند عدم التحديد
        UPDATE public.service_continuity_requests
        SET destination_entity = TRIM(p_destination_entity),
            notes = NULLIF(TRIM(p_notes), ''),
            updated_at = NOW()
        WHERE id = p_request_id AND status = 'pending_finance';
    END IF;

    -- استدعاء الموافقة الذرية المعتمدة
    RETURN public.approve_continuity_by_finance(p_request_id, p_cadre_type, p_cc_recipients);
END;
$function$;

-- 3. تحديث دالة get_service_continuity_request_for_print لإرجاع unit_text أيضاً
CREATE OR REPLACE FUNCTION public.get_service_continuity_request_for_print(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID;
    v_req RECORD;
    v_emp RECORD;
    v_sup RECORD;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الاستمرارية غير موجود');
    END IF;

    -- التحقق من الصلاحيات
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor_id
          AND (
              role = 'admin'
              OR is_printer_operator = TRUE
              OR has_printer_access = TRUE
              OR admin_role::text = ANY(ARRAY['general', 'developer', 'it_supervisor', 'hr', 'hr_supervisor']::text[])
          )
    ) OR (v_req.user_id = v_actor_id) OR (v_req.supervisor_id = v_actor_id)
      OR EXISTS (
          SELECT 1 FROM public.departments d
          WHERE (d.manager_id = v_actor_id OR d.deputy_manager_id = v_actor_id)
            AND d.governorate = v_req.governorate
      )
    INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك باستعراض بيانات هذا الكتاب للطباعة');
    END IF;

    -- جلب بروفايل الموظف مع أدق تفاصيل الهيكلية الإدارية (شعبة ووحدة وقسم)
    SELECT full_name, job_number, dept_text, section_text, unit_text, gender
    INTO v_emp
    FROM public.profiles
    WHERE id = v_req.user_id;

    -- جلب بروفايل المسؤول إن وُجد
    SELECT full_name
    INTO v_sup
    FROM public.profiles
    WHERE id = v_req.supervisor_id;

    RETURN jsonb_build_object(
        'success', true,
        'request', jsonb_build_object(
            'id', v_req.id,
            'user_id', v_req.user_id,
            'destination_entity', v_req.destination_entity,
            'include_nominal_salary', v_req.include_nominal_salary,
            'include_total_salary', v_req.include_total_salary,
            'include_salary_details', v_req.include_salary_details,
            'nominal_salary_snapshot', v_req.nominal_salary_snapshot,
            'total_salary_snapshot', v_req.total_salary_snapshot,
            'gross_salary_snapshot', v_req.gross_salary_snapshot,
            'notes', v_req.notes,
            'status', v_req.status,
            'cadre_type', COALESCE(v_req.cadre_type, 'permanent'),
            'cc_recipients', COALESCE(v_req.cc_recipients, ARRAY[]::TEXT[]),
            'supervisor_id', v_req.supervisor_id,
            'approved_by_id', v_req.approved_by_id,
            'approved_by_name', v_req.approved_by_name,
            'approved_by_title', v_req.approved_by_title,
            'rejection_reason', v_req.rejection_reason,
            'is_printed', v_req.is_printed,
            'printed_by_id', v_req.printed_by_id,
            'printed_at', v_req.printed_at,
            'official_letter_number', v_req.official_letter_number,
            'official_letter_date', v_req.official_letter_date,
            'created_at', v_req.created_at,
            'employee', jsonb_build_object(
                'full_name', v_emp.full_name,
                'job_number', v_emp.job_number,
                'dept_text', v_emp.dept_text,
                'section_text', v_emp.section_text,
                'unit_text', v_emp.unit_text,
                'gender', v_emp.gender
            ),
            'supervisor', CASE WHEN v_sup.full_name IS NOT NULL THEN jsonb_build_object('full_name', v_sup.full_name) ELSE NULL END
        )
    );
END;
$function$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.update_and_approve_continuity_by_finance(uuid, text, text, text, text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_continuity_request_for_print(uuid) TO authenticated;

-- تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';
