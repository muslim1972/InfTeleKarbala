-- ==============================================================================
-- الهجرة: 20261115030000_hr01_service_continuity_cadre_and_direct_print.sql
-- الهدف:
--   1. إضافة عمود cadre_type (permanent / contract) لجدول service_continuity_requests
--   2. تحديث دالة approve_continuity_by_finance لاستقبال صفة التعيين وقائمة النسخ وحفظها
--   3. تحديث دالة update_and_approve_continuity_by_finance لدعم نفس المتغيرات
--   4. تحديث دالة get_service_continuity_request_for_print لإرجاع cadre_type و cc_recipients
-- ==============================================================================

-- 1) إضافة عمود cadre_type
ALTER TABLE public.service_continuity_requests
ADD COLUMN IF NOT EXISTS cadre_type TEXT DEFAULT 'permanent';

COMMENT ON COLUMN public.service_continuity_requests.cadre_type IS 'صفة تعيين الموظف في كتاب الاستمرارية: permanent (على الملاك الدائم) أو contract (بصفة عقد)';

-- 2) تحديث دالة الموافقة من المالية لحفظ صفة التعيين والنسخ
CREATE OR REPLACE FUNCTION public.approve_continuity_by_finance(
    p_request_id UUID,
    p_cadre_type TEXT DEFAULT 'permanent',
    p_cc_recipients TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_actor_title TEXT;
    v_req RECORD;
    v_finance_dept RECORD;
    v_requester_name TEXT;
    v_printer_user RECORD;
    v_printers_count INT := 0;
    v_clean_cadre TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- قفل السجل
    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب الاستمرارية غير موجود';
    END IF;

    IF v_req.status <> 'pending_finance' THEN
        RAISE EXCEPTION 'عذراً، تم اتخاذ إجراء على هذا الطلب مسبقاً';
    END IF;

    -- اسم الفاعل المعتمد
    SELECT full_name INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

    -- اسم صاحب الطلب
    SELECT full_name INTO v_requester_name
    FROM public.profiles
    WHERE id = v_req.user_id;

    -- التحقق من صفة الفاعل (أصيل أو بديل)
    SELECT manager_id, deputy_manager_id INTO v_finance_dept
    FROM public.departments
    WHERE governorate = v_req.governorate
      AND (manager_id = v_actor_id OR deputy_manager_id = v_actor_id)
    LIMIT 1;

    IF v_finance_dept.manager_id = v_actor_id THEN
        v_actor_title := 'مسؤول القسم المالي والإداري';
    ELSIF v_finance_dept.deputy_manager_id = v_actor_id THEN
        v_actor_title := 'بديل مسؤول القسم المالي والإداري';
    ELSE
        v_actor_title := 'القسم المالي والإداري';
    END IF;

    v_clean_cadre := CASE 
        WHEN LOWER(TRIM(COALESCE(p_cadre_type, ''))) = 'contract' THEN 'contract'
        ELSE 'permanent'
    END;

    -- تحديث الطلب إلى جاهز للطباعة وتثبيت المعتمد وصفة التعيين والنسخ
    UPDATE public.service_continuity_requests
    SET status = 'pending_print',
        approved_by_id = v_actor_id,
        approved_by_name = v_actor_name,
        approved_by_title = v_actor_title,
        cadre_type = v_clean_cadre,
        cc_recipients = COALESCE(p_cc_recipients, cc_recipients),
        updated_at = NOW()
    WHERE id = p_request_id;

    -- أرشفة إشعارات المالية السابقة
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'service_continuity_finance';

    -- 1) إشعار الموظف صاحب الطلب
    INSERT INTO public.system_notifications (
        recipient_id,
        sender_id,
        title,
        content,
        type,
        metadata,
        created_at
    ) VALUES (
        v_req.user_id,
        v_actor_id,
        'تمت الموافقة على طلب تأييد الاستمرارية',
        'طلبك قد اكتمل وسيصلك في البريد الداخلي بأقرب وقت',
        'success',
        jsonb_build_object(
            'request_id', p_request_id,
            'approved_by_name', v_actor_name,
            'approved_by_title', v_actor_title
        ),
        NOW()
    );

    -- 2) إشعار موظف الطابعة في نفس المحافظة
    FOR v_printer_user IN
        SELECT id FROM public.profiles
        WHERE (has_printer_access = TRUE OR is_printer_operator = TRUE)
          AND governorate = v_req.governorate
    LOOP
        v_printers_count := v_printers_count + 1;
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata,
            created_at
        ) VALUES (
            v_printer_user.id,
            v_actor_id,
            'طلب تأييد استمرارية جاهز للطباعة',
            format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity),
            'service_continuity_print',
            jsonb_build_object(
                'request_id', p_request_id,
                'requester_name', v_requester_name,
                'destination_entity', v_req.destination_entity,
                'notes', v_req.notes,
                'approved_by_name', v_actor_name,
                'approved_by_title', v_actor_title,
                'governorate', v_req.governorate,
                'cadre_type', v_clean_cadre
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تمت الموافقة بنجاح وأحيل الطلب إلى موظف الطابعة للطباعة',
        'approved_by_name', v_actor_name,
        'approved_by_title', v_actor_title,
        'printers_notified', v_printers_count
    );
END;
$$;

-- 3) تحديث دالة التعديل والموافقة
CREATE OR REPLACE FUNCTION public.update_and_approve_continuity_by_finance(
    p_request_id UUID,
    p_destination_entity TEXT,
    p_notes TEXT DEFAULT NULL,
    p_cadre_type TEXT DEFAULT 'permanent',
    p_cc_recipients TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_destination_entity IS NULL OR TRIM(p_destination_entity) = '' THEN
        RAISE EXCEPTION 'يرجى تحديد الجهة المعنون إليها الكتاب';
    END IF;

    UPDATE public.service_continuity_requests
    SET destination_entity = TRIM(p_destination_entity),
        notes = NULLIF(TRIM(p_notes), ''),
        updated_at = NOW()
    WHERE id = p_request_id AND status = 'pending_finance';

    -- استدعاء الموافقة الذرية
    RETURN public.approve_continuity_by_finance(p_request_id, p_cadre_type, p_cc_recipients);
END;
$$;

-- 4) تحديث دالة جلب بيانات الطباعة لإرجاع cadre_type و cc_recipients
CREATE OR REPLACE FUNCTION public.get_service_continuity_request_for_print(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

    -- جلب بروفايل الموظف
    SELECT full_name, job_number, dept_text, section_text, gender
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
                'gender', v_emp.gender
            ),
            'supervisor', CASE WHEN v_sup.full_name IS NOT NULL THEN jsonb_build_object('full_name', v_sup.full_name) ELSE NULL END
        )
    );
END;
$$;

-- منح الصلاحيات
GRANT ALL ON TABLE public.service_continuity_requests TO postgres, authenticated, service_role;
