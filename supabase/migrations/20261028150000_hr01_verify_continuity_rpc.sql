-- ==============================================================================
-- محرك التحقق الرقمي من صحة صدور كتب تأييد الاستمرارية (QR Verification Engine)
-- النواة المعمارية: BE-HR-01
-- التاريخ: 2026-10-28
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_continuity_letter(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_emp RECORD;
    v_clean_purpose TEXT := '';
BEGIN
    IF p_request_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'معرّف الوثيقة غير صالح'
        );
    END IF;

    -- قراءة الطلب مع شرط الصدور الأصولي الحصري
    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF v_req.id IS NULL OR v_req.status != 'issued_and_dispatched' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'الوثيقة غير صالحة أو لم تصدر أصولياً من مديرية اتصالات ومعلوماتية كربلاء'
        );
    END IF;

    -- جلب بيانات الموظف
    SELECT full_name, job_number, dept_text, section_text INTO v_emp
    FROM public.profiles
    WHERE id = v_req.user_id;

    -- تنظيف الغرض
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
        'nominal_salary_snapshot', v_req.nominal_salary_snapshot,
        'include_total_salary', v_req.include_total_salary,
        'total_salary_snapshot', v_req.total_salary_snapshot,
        'notes', v_clean_purpose,
        'cc_recipients', COALESCE(v_req.cc_recipients, '{}'::TEXT[]),
        'created_at', v_req.created_at,
        'issued_at', v_req.hr_decision_at,
        'verified_at', NOW()
    );
END;
$$;

-- منح الصلاحية لـ anon (المواطنين والجهات الخارجية عند مسح QR) و authenticated
GRANT EXECUTE ON FUNCTION public.verify_continuity_letter(UUID) TO anon, authenticated;
ALTER FUNCTION public.verify_continuity_letter(UUID) OWNER TO supabase_admin;

-- إشعار PostgREST بتحديث المخطط فوراً
NOTIFY pgrst, 'reload schema';
