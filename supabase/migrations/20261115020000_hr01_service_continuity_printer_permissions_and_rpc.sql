-- ==============================================================================
-- Migration: 20261115020000_hr01_service_continuity_printer_permissions_and_rpc.sql
-- Kernel: BE-HR-01
-- Purpose: 
--   1. Grant printer operators permission in process_service_continuity_hr_issue and allow pending_print status.
--   2. Update RLS on service_continuity_requests to allow printer operators & finance managers/deputies.
--   3. Create get_service_continuity_request_for_print RPC for seamless, secure data retrieval.
--   4. Include purpose/notes in service_continuity_print notifications.
-- ==============================================================================

-- 1) تحديث سياسة SELECT على service_continuity_requests للسماح لموظفي الطابعة ومسؤولي الإدارة وبدائلهم
DROP POLICY IF EXISTS "Users can view own continuity requests" ON public.service_continuity_requests;

CREATE POLICY "Users can view own continuity requests" ON public.service_continuity_requests
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR supervisor_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() 
          AND (
              p.role = 'admin' 
              OR p.is_printer_operator = TRUE 
              OR p.has_printer_access = TRUE
              OR p.admin_role::text = ANY(ARRAY['general', 'developer', 'it_supervisor', 'hr', 'hr_supervisor']::text[])
          )
    )
    OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE (d.manager_id = auth.uid() OR d.deputy_manager_id = auth.uid())
          AND d.governorate = service_continuity_requests.governorate
    )
);

-- 2) دالة استرجاع بيانات كتاب الاستمرارية للطباعة والمعالجة (آمنة وذرية)
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
            'cc_recipients', v_req.cc_recipients,
            'created_at', v_req.created_at,
            'employee', jsonb_build_object(
                'full_name', v_emp.full_name,
                'job_number', v_emp.job_number,
                'dept_text', v_emp.dept_text,
                'section_text', v_emp.section_text,
                'gender', v_emp.gender
            ),
            'supervisor', jsonb_build_object(
                'full_name', v_sup.full_name
            )
        )
    );
END;
$$;

-- 3) تحديث دالة process_service_continuity_hr_issue لقبول موظف الطابعة وحالة pending_print
CREATE OR REPLACE FUNCTION public.process_service_continuity_hr_issue(
    p_request_id UUID,
    p_action TEXT,
    p_official_letter_number TEXT DEFAULT NULL,
    p_official_letter_date DATE DEFAULT NULL,
    p_dispatch_notes TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_cc_recipients TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_actor_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_location_name TEXT := 'موقع العمل';
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- التحقق من صلاحية HR أو موظف الطابعة أو المشرف العام
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor_id
          AND (
              role = 'admin' 
              OR admin_role IN ('hr', 'hr_supervisor', 'general', 'developer')
              OR is_printer_operator = TRUE
              OR has_printer_access = TRUE
          )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'غير مصرح لك بإصدار أو معالجة كتب الاستمرارية';
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'الطلب غير موجود';
    END IF;

    -- السماح بحالتي pending_hr أو pending_print
    IF v_req.status NOT IN ('pending_hr', 'pending_print') THEN
        RAISE EXCEPTION 'الطلب ليس في مرحلة الطباعة أو الإصدار الحالية (%s)', v_req.status;
    END IF;

    -- جلب اسم موقع العمل للتسليم بالبريد الداخلي
    IF v_req.work_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name
        FROM public.work_locations
        WHERE id = v_req.work_location_id;
    END IF;

    IF p_action = 'issue' THEN
        IF p_official_letter_number IS NULL OR TRIM(p_official_letter_number) = '' THEN
            RAISE EXCEPTION 'يرجى إدخال رقم الكتاب الرسمي الصادر';
        END IF;

        IF p_official_letter_date IS NULL THEN
            p_official_letter_date := CURRENT_DATE;
        END IF;

        UPDATE public.service_continuity_requests
        SET
            status = 'issued_and_dispatched',
            official_letter_number = TRIM(p_official_letter_number),
            official_letter_date = p_official_letter_date,
            dispatch_notes = p_dispatch_notes,
            hr_processor_id = v_actor_id,
            hr_decision_at = NOW(),
            hr_notes = p_notes,
            cc_recipients = COALESCE(p_cc_recipients, '{}'::TEXT[]),
            is_printed = TRUE,
            printed_by_id = v_actor_id,
            printed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_request_id;

        -- أرشفة إشعارات الطباعة الخاصة بهذا الطلب
        UPDATE public.system_notifications
        SET is_read = TRUE
        WHERE metadata->>'request_id' = p_request_id::TEXT
          AND type = 'service_continuity_print';

        -- إشعار نهائي سارّ للموظف
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata
        ) VALUES (
            v_req.user_id,
            v_actor_id,
            'تم إصدار كتاب تأييد الاستمرارية وإرساله بالبريد الداخلي',
            'تم إصدار كتاب تأييد الاستمرارية بالعدد (' || TRIM(p_official_letter_number) || ') بتاريخ (' || p_official_letter_date::TEXT || ')، وهو في طريقه إليك عبر البريد الداخلي إلى (' || COALESCE(v_location_name, 'موقع عملك') || ').',
            'success',
            jsonb_build_object(
                'request_id', p_request_id,
                'official_letter_number', TRIM(p_official_letter_number),
                'official_letter_date', p_official_letter_date,
                'location', v_location_name
            )
        );

    ELSIF p_action = 'reject' THEN
        IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
            RAISE EXCEPTION 'يرجى بيان سبب عدم الإصدار أو الرفض';
        END IF;

        UPDATE public.service_continuity_requests
        SET
            status = 'rejected_by_hr',
            hr_processor_id = v_actor_id,
            hr_decision_at = NOW(),
            hr_notes = p_notes,
            rejection_reason = SUBSTRING(TRIM(p_notes) FROM 1 FOR 256),
            updated_at = NOW()
        WHERE id = p_request_id;

        -- أرشفة إشعارات الطباعة
        UPDATE public.system_notifications
        SET is_read = TRUE
        WHERE metadata->>'request_id' = p_request_id::TEXT
          AND type = 'service_continuity_print';

        -- إشعار الموظف بالرفض
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata
        ) VALUES (
            v_req.user_id,
            v_actor_id,
            'تم الاعتذار عن إصدار كتاب تأييد الاستمرارية',
            'نعتذر، لم يتم إصدار كتاب تأييد الاستمرارية بالسبب: (' || p_notes || '). يرجى مراجعة شعبة الموارد البشرية أو تقديم طلب جديد بعد تصحيح النواقص.',
            'error',
            jsonb_build_object(
                'request_id', p_request_id,
                'reason', p_notes
            )
        );
    ELSE
        RAISE EXCEPTION 'الإجراء غير صالح (%s)', p_action;
    END IF;

    -- تدوين في سجل التدقيق
    INSERT INTO public.service_continuity_audit_log (
        request_id,
        actor_id,
        action,
        action_details,
        governorate
    ) VALUES (
        p_request_id,
        v_actor_id,
        'hr_decision_' || p_action,
        jsonb_build_object('notes', p_notes, 'dispatch_notes', p_dispatch_notes, 'letter_number', p_official_letter_number, 'cc_recipients', p_cc_recipients),
        v_req.governorate
    );

    RETURN jsonb_build_object('success', TRUE, 'action', p_action);
END;
$$;

-- 4) تحديث approve_continuity_by_finance لتضمين الغرض والملاحظات في إشعار موظف الطابعة
CREATE OR REPLACE FUNCTION public.approve_continuity_by_finance(p_request_id UUID)
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
    v_requester_name TEXT;
    v_finance_dept RECORD;
    v_printer_user RECORD;
    v_printers_count INT := 0;
    v_print_content TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- قفل ذري للطلب لمنع سباق التزامن
    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب الاستمرارية غير موجود';
    END IF;

    IF v_req.status <> 'pending_finance' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'الطلب تمت معالجته مسبقاً من قِبل مسؤول الإدارة أو بديله'
        );
    END IF;

    -- جلب معلومات متخذ القرار
    SELECT full_name INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

    -- تحديد صفته
    SELECT id, manager_id, deputy_manager_id INTO v_finance_dept
    FROM public.departments
    WHERE governorate = v_req.governorate
      AND (manager_id = v_actor_id OR deputy_manager_id = v_actor_id)
      AND (
          name LIKE '%المالي والاداري%' 
          OR name LIKE '%المالي والإداري%' 
          OR name LIKE '%المالية والادارية%'
          OR name LIKE '%المالية والإدارية%'
          OR name LIKE '%المالي%'
      )
    LIMIT 1;

    IF v_finance_dept.id IS NOT NULL THEN
        IF v_finance_dept.manager_id = v_actor_id THEN
            v_actor_title := 'مسؤول القسم المالي والإداري';
        ELSE
            v_actor_title := 'معاون (بديل) مسؤول القسم المالي والإداري';
        END IF;
    ELSE
        v_actor_title := 'القسم المالي والإداري';
    END IF;

    -- جلب اسم صاحب الطلب
    SELECT full_name INTO v_requester_name
    FROM public.profiles
    WHERE id = v_req.user_id;

    -- تحديث حالة الطلب إلى pending_print مع توثيق المعتمد
    UPDATE public.service_continuity_requests
    SET
        status = 'pending_print',
        approved_by_id = v_actor_id,
        approved_by_name = v_actor_name,
        approved_by_title = v_actor_title,
        supervisor_decision_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    -- أرشفة إشعارات الأصيل والبديل فوراً
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::TEXT
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

    -- صياغة نص إشعار موظف الطابعة متضمناً الغرض إن وُجد
    IF v_req.notes IS NOT NULL AND TRIM(v_req.notes) <> '' THEN
        v_print_content := format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s) - الغرض: (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity, TRIM(v_req.notes));
    ELSE
        v_print_content := format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity);
    END IF;

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
            v_print_content,
            'service_continuity_print',
            jsonb_build_object(
                'request_id', p_request_id,
                'requester_name', v_requester_name,
                'destination_entity', v_req.destination_entity,
                'notes', v_req.notes,
                'approved_by_name', v_actor_name,
                'approved_by_title', v_actor_title,
                'governorate', v_req.governorate
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'pending_print',
        'printers_notified', v_printers_count,
        'message', 'تمت الموافقة بنجاح وأحيل الطلب لموظف الطابعة'
    );
END;
$$;
