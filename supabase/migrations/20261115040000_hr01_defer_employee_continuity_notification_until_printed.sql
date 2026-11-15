-- ==============================================================================
-- الهجرة: 20261115040000_hr01_defer_employee_continuity_notification_until_printed.sql
-- الهدف المعماري:
--   تأجيل إرسال إشعار اكتمال طلب الاستمرارية لصاحب الطلب (الموظف)
--   بحيث لا ينطلق عند موافقة مسؤول المالية، بل ينطلق حصراً عندما يضغط
--   موظف الطابعة على زر الطباعة (mark_continuity_printed)، مع تعديل
--   عنوان الإشعار ليصبح: "تمت الموافقة والطباعة"
-- ==============================================================================

-- 1) إسقاط النسخة القديمة ذات المعامل الواحد لتفادي التضارب
DROP FUNCTION IF EXISTS public.approve_continuity_by_finance(UUID);

-- 2) تحديث دالة الموافقة من المالية (إزالة إشعار صاحب الطلب وحصره بموظف الطابعة فقط)
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
    v_print_content TEXT;
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

    -- أرشفة إشعارات المالية السابقة الخاصة بهذا الطلب
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'service_continuity_finance';

    -- صياغة محتوى إشعار موظف الطابعة متضمناً الغرض إن وُجد
    IF v_req.notes IS NOT NULL AND TRIM(v_req.notes) <> '' THEN
        v_print_content := format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s) - الغرض: (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity, TRIM(v_req.notes));
    ELSE
        v_print_content := format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity);
    END IF;

    -- إرسال الإشعار لموظفي الطابعة في نفس المحافظة (دون إشعار صاحب الطلب في هذه المرحلة)
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

-- 3) تحديث دالة توثيق الطباعة mark_continuity_printed لإرسال الإشعار لصاحب الطلب فور نقر موظف الطابعة زر طباعة
CREATE OR REPLACE FUNCTION public.mark_continuity_printed(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_req RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- قفل وجلب بيانات طلب الاستمرارية
    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الاستمرارية غير موجود');
    END IF;

    -- تحديث حالة الطلب إلى مكتمل وتوثيق الطباعة
    UPDATE public.service_continuity_requests
    SET is_printed = TRUE,
        printed_by_id = v_actor_id,
        printed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- أرشفة إشعار الطابعة لهذا الطلب
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'service_continuity_print';

    -- إرسال الإشعار النهائي لصاحب الطلب الموظف الآن بعد الطباعة
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
        'تمت الموافقة والطباعة',
        'طلبك قد اكتمل وسيصلك في البريد الداخلي بأقرب وقت',
        'success',
        jsonb_build_object(
            'request_id', p_request_id,
            'approved_by_name', v_req.approved_by_name,
            'approved_by_title', v_req.approved_by_title,
            'is_printed', true,
            'printed_at', NOW()
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم توثيق طباعة الكتاب وإشعار صاحب الطلب بنجاح'
    );
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.approve_continuity_by_finance(UUID, TEXT, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_continuity_printed(UUID) TO authenticated, service_role;
