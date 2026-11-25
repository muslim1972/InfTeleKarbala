-- ==============================================================================
-- Migration: 20261125113000_hr01_fix_continuity_net_vs_gross_salary.sql
-- Kernel: BE-HR-01
-- Purpose: Fix bug where update_and_approve_continuity_by_finance wrote v_gross
--          into both total_salary_snapshot (Net) and gross_salary_snapshot (Gross),
--          restore affected rows from financial_records.net_salary, and return
--          gross/net explicitly in get_service_continuity_request_for_print &
--          verify_continuity_letter RPCs.
-- ==============================================================================

-- 1. إصلاح السجلات التي تساوى فيها الصافي (total_salary_snapshot) مع الكلي (gross_salary_snapshot) بسبب التعديل السابق
UPDATE public.service_continuity_requests scr
SET total_salary_snapshot = fr.net_salary,
    gross_salary_snapshot = COALESCE(NULLIF(scr.gross_salary_snapshot, 0), fr.gross_salary, fr.nominal_salary, 0),
    nominal_salary_snapshot = COALESCE(NULLIF(scr.nominal_salary_snapshot, 0), fr.nominal_salary, 0)
FROM public.financial_records fr
WHERE fr.user_id = scr.user_id
  AND COALESCE(fr.net_salary, 0) > 0
  AND COALESCE(fr.gross_salary, 0) > 0
  AND fr.net_salary <> fr.gross_salary
  AND (
      COALESCE(scr.total_salary_snapshot, 0) = COALESCE(scr.gross_salary_snapshot, 0)
      OR COALESCE(scr.total_salary_snapshot, 0) = COALESCE(fr.gross_salary, 0)
  )
  AND (scr.include_nominal_salary = TRUE OR scr.include_total_salary = TRUE OR scr.include_salary_details = TRUE);

-- 2. إصلاح دالة update_and_approve_continuity_by_finance: تخزين v_net في total_salary_snapshot و v_gross في gross_salary_snapshot
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

    SELECT user_id INTO v_user_id
    FROM public.service_continuity_requests
    WHERE id = p_request_id AND status = 'pending_finance';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الاستمرارية غير موجود أو تمت معالجته مسبقاً');
    END IF;

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
            total_salary_snapshot = CASE WHEN COALESCE(total_salary_snapshot, 0) > 0 AND total_salary_snapshot <> COALESCE(gross_salary_snapshot, 0) THEN total_salary_snapshot ELSE v_net END,
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
        UPDATE public.service_continuity_requests
        SET destination_entity = TRIM(p_destination_entity),
            notes = NULLIF(TRIM(p_notes), ''),
            updated_at = NOW()
        WHERE id = p_request_id AND status = 'pending_finance';
    END IF;

    RETURN public.approve_continuity_by_finance(p_request_id, p_cadre_type, p_cc_recipients);
END;
$function$;

-- 3. ضمان إرجاع صافي الراتب والكلي بدقة من get_service_continuity_request_for_print
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
    v_fin RECORD;
    v_is_authorized BOOLEAN := FALSE;
    v_effective_gross NUMERIC(12, 2);
    v_effective_net NUMERIC(12, 2);
    v_effective_nominal NUMERIC(12, 2);
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

    SELECT full_name, job_number, dept_text, section_text, unit_text, gender
    INTO v_emp
    FROM public.profiles
    WHERE id = v_req.user_id;

    SELECT full_name
    INTO v_sup
    FROM public.profiles
    WHERE id = v_req.supervisor_id;

    SELECT COALESCE(nominal_salary, 0) AS nominal_salary,
           COALESCE(gross_salary, 0) AS gross_salary,
           COALESCE(net_salary, 0) AS net_salary
    INTO v_fin
    FROM public.financial_records
    WHERE user_id = v_req.user_id
    LIMIT 1;

    v_effective_nominal := COALESCE(NULLIF(v_req.nominal_salary_snapshot, 0), v_fin.nominal_salary, 0);
    v_effective_gross := COALESCE(NULLIF(v_req.gross_salary_snapshot, 0), v_fin.gross_salary, v_req.total_salary_snapshot, 0);
    -- إذا تساوى الصافي والكلي في اللقطة بالخطأ، نأخذ صافي الراتب الحقيقي من السجل المالي
    v_effective_net := CASE
        WHEN COALESCE(v_req.total_salary_snapshot, 0) > 0 AND COALESCE(v_req.total_salary_snapshot, 0) <> COALESCE(v_effective_gross, 0)
            THEN v_req.total_salary_snapshot
        WHEN COALESCE(v_fin.net_salary, 0) > 0
            THEN v_fin.net_salary
        ELSE COALESCE(v_req.total_salary_snapshot, 0)
    END;

    RETURN jsonb_build_object(
        'success', true,
        'request', jsonb_build_object(
            'id', v_req.id,
            'user_id', v_req.user_id,
            'destination_entity', v_req.destination_entity,
            'include_nominal_salary', v_req.include_nominal_salary,
            'include_total_salary', v_req.include_total_salary,
            'include_salary_details', v_req.include_salary_details,
            'nominal_salary_snapshot', v_effective_nominal,
            'total_salary_snapshot', v_effective_net,
            'net_salary_snapshot', v_effective_net,
            'gross_salary_snapshot', v_effective_gross,
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

-- 4. تحديث دالة التحقق الرقمي verify_continuity_letter لإرجاع الكلي والصافي منفصلين بدقة
DROP FUNCTION IF EXISTS public.verify_continuity_letter(UUID);
CREATE OR REPLACE FUNCTION public.verify_continuity_letter(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_emp RECORD;
    v_fin RECORD;
    v_clean_purpose TEXT := '';
    v_effective_gross NUMERIC(12, 2);
    v_effective_net NUMERIC(12, 2);
    v_effective_nominal NUMERIC(12, 2);
BEGIN
    IF p_request_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'معرّف الوثيقة غير صالح'
        );
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF v_req.id IS NULL OR v_req.status != 'issued_and_dispatched' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'الوثيقة غير صالحة أو لم تصدر أصولياً من مديرية اتصالات ومعلوماتية كربلاء'
        );
    END IF;

    SELECT full_name, job_number, dept_text, section_text INTO v_emp
    FROM public.profiles
    WHERE id = v_req.user_id;

    SELECT COALESCE(nominal_salary, 0) AS nominal_salary,
           COALESCE(gross_salary, 0) AS gross_salary,
           COALESCE(net_salary, 0) AS net_salary
    INTO v_fin
    FROM public.financial_records
    WHERE user_id = v_req.user_id
    LIMIT 1;

    v_effective_nominal := COALESCE(NULLIF(v_req.nominal_salary_snapshot, 0), v_fin.nominal_salary, 0);
    v_effective_gross := COALESCE(NULLIF(v_req.gross_salary_snapshot, 0), v_fin.gross_salary, v_req.total_salary_snapshot, 0);
    v_effective_net := CASE
        WHEN COALESCE(v_req.total_salary_snapshot, 0) > 0 AND COALESCE(v_req.total_salary_snapshot, 0) <> COALESCE(v_effective_gross, 0)
            THEN v_req.total_salary_snapshot
        WHEN COALESCE(v_fin.net_salary, 0) > 0
            THEN v_fin.net_salary
        ELSE COALESCE(v_req.total_salary_snapshot, 0)
    END;

    IF v_req.notes IS NOT NULL THEN
        v_clean_purpose := REGEXP_REPLACE(TRIM(v_req.notes), '^(لأغراض|لاغراض|لغرض|بغرض|غرض)\s+', '', 'i');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req.id,
        'official_letter_number', v_req.official_letter_number,
        'official_letter_date', v_req.official_letter_date,
        'destination_entity', v_req.destination_entity,
        'employee_name', COALESCE(v_emp.full_name, 'موظف'),
        'job_number', COALESCE(v_emp.job_number, '—'),
        'job_title', COALESCE(v_emp.section_text, 'موظف'),
        'department', COALESCE(v_emp.dept_text, 'مديرية اتصالات ومعلوماتية كربلاء'),
        'include_nominal_salary', v_req.include_nominal_salary,
        'nominal_salary_snapshot', v_effective_nominal,
        'include_total_salary', v_req.include_total_salary,
        'total_salary_snapshot', v_effective_net,
        'net_salary_snapshot', v_effective_net,
        'gross_salary_snapshot', v_effective_gross,
        'notes', v_clean_purpose,
        'cc_recipients', COALESCE(v_req.cc_recipients, '{}'::TEXT[]),
        'created_at', v_req.created_at,
        'issued_at', v_req.hr_decision_at,
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_continuity_letter(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
