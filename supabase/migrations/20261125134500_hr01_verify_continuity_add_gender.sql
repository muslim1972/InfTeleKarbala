-- إضافة حقل gender إلى دالة verify_continuity_letter ليظهر لقب (السيد / السيدة) بدقة في صفحة التحقق الإلكتروني
CREATE OR REPLACE FUNCTION public.verify_continuity_letter(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    SELECT full_name, job_number, dept_text, section_text, gender INTO v_emp
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
        'gender', v_emp.gender,
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
$function$;

NOTIFY pgrst, 'reload schema';
