-- مسار الإجازة الطويلة الكامل: البديل -> المسؤول المباشر -> (الموظف + المالي والإداري وبديله) -> موظف الطابعة -> الطباعة الأولى
BEGIN;

-- 1. أعمدة المتابعة المالية والطباعة على جدول leave_requests
ALTER TABLE public.leave_requests
    ADD COLUMN IF NOT EXISTS cadre_type TEXT DEFAULT 'permanent',
    ADD COLUMN IF NOT EXISTS cc_recipients TEXT[] DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS finance_status TEXT DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS finance_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS finance_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS printed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;

-- 2. تحديث respond_to_substitute_request بنص الإشعار الدقيق للموظف وللمسؤول المباشر
DO $$
DECLARE
    v_res text;
BEGIN
    SELECT pg_get_functiondef(oid) INTO v_res FROM pg_proc WHERE proname = 'respond_to_substitute_request' LIMIT 1;

    -- تحديث إشعار الموظف عند موافقة البديل
    v_res := replace(
        v_res,
        '''وافق الزميل ('' || COALESCE(v_sub_name, ''البديل'') || '') على التكليف كبديل عنك لتاريخ '' || COALESCE(v_req.start_date::text, ''يُحدد لاحقاً'') || ''. تم الآن إرسال طلبك تلقائياً إلى مسؤولك المباشر للاعتماد.''',
        'CASE WHEN v_req.leave_type = ''long_regular'' THEN ''وافق الزميل ('' || COALESCE(v_sub_name, ''البديل'') || '') على التكليف كبديل عنك في إجازتك الطويلة ('' || COALESCE(v_req.days_count, 10) || '' يوم)، وأنت الآن بانتظار موافقة المسؤول المباشر.'' ELSE ''وافق الزميل ('' || COALESCE(v_sub_name, ''البديل'') || '') على التكليف كبديل عنك لتاريخ '' || COALESCE(v_req.start_date::text, ''يُحدد لاحقاً'') || ''. تم الآن إرسال طلبك تلقائياً إلى مسؤولك المباشر للاعتماد.'' END'
    );

    -- تحديث إشعار المسؤول المباشر عند موافقة البديل على الإجازة الطويلة
    v_res := replace(
        v_res,
        'v_notif_title := ''طلب إجازة جديد (معتمد من البديل)'';',
        'IF v_req.leave_type = ''long_regular'' THEN v_notif_title := ''طلب إجازة اعتيادية طويلة (معتمد من البديل)''; ELSE v_notif_title := ''طلب إجازة جديد (معتمد من البديل)''; END IF;'
    );
    v_res := replace(
        v_res,
        'v_notif_content := ''طلب إجازة جديد بانتظار موافقتك بعد موافقة البديل ('' || COALESCE(v_sub_name, ''البديل'') || ''). ('' || COALESCE(v_req.reason, '''') || '')'';',
        'IF v_req.leave_type = ''long_regular'' THEN v_notif_content := ''قدّم الموظف طلب إجازة اعتيادية طويلة لمدة ('' || COALESCE(v_req.days_count, 10) || '' يوم)، ووافق البديل ('' || COALESCE(v_sub_name, ''البديل'') || '') على طلبه. ('' || COALESCE(v_req.reason, '''') || '')''; ELSE v_notif_content := ''طلب إجازة جديد بانتظار موافقتك بعد موافقة البديل ('' || COALESCE(v_sub_name, ''البديل'') || ''). ('' || COALESCE(v_req.reason, '''') || '')''; END IF;'
    );

    EXECUTE v_res;
END $$;

-- 3. تحديث core_settle_request_approval:
--    عند موافقة المسؤول المباشر على long_regular:
--    أ) يرسل للموظف النص المطلوب مع وسم اطلاع
--    ب) يرسل في نفس الوقت إشعار long_leave_finance لمسؤول القسم المالي والإداري وبديله
CREATE OR REPLACE FUNCTION public.core_settle_request_approval(p_request_id uuid, p_approver_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_approver_name TEXT;
    v_requester_id UUID;
    v_requester_name TEXT;
    v_gov TEXT;
    v_leave_type TEXT;
    v_destination TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_days_count INTEGER;
    v_with_pay BOOLEAN;
    v_reason TEXT;
    v_action_ar TEXT;
    v_emp_title TEXT;
    v_emp_content TEXT;
    v_finance_manager_id UUID;
    v_finance_deputy_id UUID;
    v_fin_body TEXT;
    v_fin_meta JSONB;
BEGIN
    SELECT full_name INTO v_approver_name FROM public.profiles WHERE id = p_approver_id;

    SELECT user_id, leave_type, destination, start_date, end_date, days_count, COALESCE(with_pay, TRUE), reason
    INTO v_requester_id, v_leave_type, v_destination, v_start_date, v_end_date, v_days_count, v_with_pay, v_reason
    FROM public.leave_requests WHERE id = p_request_id;

    IF v_requester_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'الطلب غير موجود');
    END IF;

    SELECT full_name, COALESCE(governorate, 'karbala') INTO v_requester_name, v_gov
    FROM public.profiles WHERE id = v_requester_id;

    v_action_ar := CASE WHEN p_action = 'approved' THEN 'الموافقة على' ELSE 'رفض' END;

    UPDATE public.system_notifications
    SET
        type = 'leave_fyi',
        title = format('للعلم فقط: تم %s الطلب', v_action_ar),
        content = format('قام المسؤول (%s) بـ %s طلب الموظف (%s)', COALESCE(v_approver_name, 'مسؤول'), v_action_ar, COALESCE(v_requester_name, 'موظف')),
        metadata = metadata || jsonb_build_object(
            'fyi_action_by', COALESCE(v_approver_name, 'مسؤول'),
            'fyi_action', p_action,
            'is_actionable', FALSE,
            'can_acknowledge', TRUE
        )
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id <> p_approver_id
      AND is_read = FALSE;

    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id = p_approver_id;

    IF v_leave_type = 'duty' THEN
        v_emp_title := format('تم %s طلب الواجب الرسمي', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب خروجك لتنفيذ واجب رسمي إلى (%s) بتاريخ (%s).',
                                COALESCE(v_approver_name, 'المسؤول'), v_action_ar, COALESCE(v_destination, 'الجهة المحددة'), v_start_date);
    ELSIF v_leave_type = 'time_off' THEN
        v_emp_title := format('تم %s طلب الإجازة الزمنية', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب إجازتك الزمنية بتاريخ (%s).',
                                COALESCE(v_approver_name, 'المسؤول'), v_action_ar, v_start_date);
    ELSIF v_leave_type = 'long_regular' AND p_action = 'approved' THEN
        v_emp_title := 'تمت الموافقة من المسؤول المباشر على الإجازة الطويلة';
        v_emp_content := format('تمت الموافقة على طلب الإجازة من قبل المسؤول المباشر (%s). لذا يجب عليك مراجعة الموارد البشرية لاستكمال براءة الذمة وإصدار الأمر.',
                                COALESCE(v_approver_name, 'المسؤول المباشر'));
    ELSIF v_leave_type = 'long_regular' THEN
        v_emp_title := format('تم %s طلب الإجازة الطويلة', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب إجازتك الطويلة البالغة %s يوم.',
                                COALESCE(v_approver_name, 'المسؤول'), v_action_ar, COALESCE(v_days_count, 10));
    ELSE
        v_emp_title := format('تم %s طلب الإجازة', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب إجازتك للفترة من (%s) إلى (%s).',
                                COALESCE(v_approver_name, 'المسؤول'), v_action_ar, v_start_date, v_end_date);
    END IF;

    INSERT INTO public.system_notifications (
        recipient_id, sender_id, type, title, content, is_read, metadata, created_at
    ) VALUES (
        v_requester_id,
        p_approver_id,
        'leave_response',
        v_emp_title,
        v_emp_content,
        FALSE,
        jsonb_build_object(
            'request_id', p_request_id,
            'leave_type', v_leave_type,
            'action', p_action,
            'action_by', v_approver_name,
            'notes', p_notes,
            'can_acknowledge', (v_leave_type = 'long_regular' AND p_action = 'approved')
        ),
        NOW()
    );

    -- عند موافقة المسؤول المباشر على الإجازة الطويلة: تحويل فوري في نفس الوقت لمسؤول المالي والإداري وبديله
    IF v_leave_type = 'long_regular' AND p_action = 'approved' THEN
        UPDATE public.leave_requests
        SET finance_status = 'pending_finance'
        WHERE id = p_request_id;

        SELECT manager_id, deputy_manager_id
        INTO v_finance_manager_id, v_finance_deputy_id
        FROM public.departments
        WHERE governorate = v_gov
          AND (name LIKE '%المالي والاداري%' OR name LIKE '%المالية والادارية%' OR name LIKE '%المالي والإداري%')
        ORDER BY CASE WHEN name LIKE '%المالي والاداري%' THEN 1 ELSE 2 END ASC
        LIMIT 1;

        v_fin_body := format(
            'قدم الموظف (%s) طلب إجازة اعتيادية طويلة لمدة (%s يوم) (%s) بعد موافقة المسؤول المباشر (%s).',
            COALESCE(v_requester_name, 'موظف'),
            COALESCE(v_days_count, 10),
            CASE WHEN v_with_pay THEN 'براتب تام' ELSE 'بدون راتب' END,
            COALESCE(v_approver_name, 'المسؤول')
        );

        v_fin_meta := jsonb_build_object(
            'request_id', p_request_id,
            'leave_type', 'long_regular',
            'requester_id', v_requester_id,
            'requester_name', COALESCE(v_requester_name, 'موظف'),
            'days_count', COALESCE(v_days_count, 10),
            'with_pay', v_with_pay,
            'notes', COALESCE(v_reason, ''),
            'supervisor_name', COALESCE(v_approver_name, '')
        );

        IF v_finance_manager_id IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, title, content, type, metadata, created_at
            ) VALUES (
                v_finance_manager_id, v_requester_id,
                'طلب إجازة اعتيادية طويلة للمراجعة والاعتماد',
                v_fin_body,
                'long_leave_finance',
                v_fin_meta,
                NOW()
            );
        END IF;

        IF v_finance_deputy_id IS NOT NULL AND v_finance_deputy_id IS DISTINCT FROM v_finance_manager_id THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, title, content, type, metadata, created_at
            ) VALUES (
                v_finance_deputy_id, v_requester_id,
                'طلب إجازة اعتيادية طويلة للمراجعة والاعتماد (نسخة البديل)',
                v_fin_body,
                'long_leave_finance',
                v_fin_meta,
                NOW()
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- 4. معالجة مسؤول القسم المالي والإداري وبديله لطلب الإجازة الطويلة (تعديل + موافقة + رفض)
CREATE OR REPLACE FUNCTION public.process_long_leave_finance(
    p_request_id uuid,
    p_action text,
    p_days_count integer DEFAULT NULL,
    p_with_pay boolean DEFAULT NULL,
    p_cadre_type text DEFAULT 'permanent',
    p_notes text DEFAULT NULL,
    p_cc_recipients text[] DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID := auth.uid();
    v_req RECORD;
    v_emp_name TEXT;
    v_gov TEXT;
    v_is_auth BOOLEAN := FALSE;
    v_printer RECORD;
    v_eff_days INTEGER;
    v_eff_pay BOOLEAN;
    v_eff_cadre TEXT;
    v_eff_notes TEXT;
    v_eff_cc TEXT[];
BEGIN
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم غير مسجل الدخول');
    END IF;

    SELECT lr.*, COALESCE(p.governorate, 'karbala') AS emp_gov, p.full_name AS emp_name
    INTO v_req
    FROM public.leave_requests lr
    JOIN public.profiles p ON p.id = lr.user_id
    WHERE lr.id = p_request_id
    FOR UPDATE OF lr;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الإجازة غير موجود');
    END IF;

    v_gov := v_req.emp_gov;
    v_emp_name := v_req.emp_name;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_actor_id
          AND (
              p.admin_role IN ('developer', 'general', 'finance', 'hr', 'hr_supervisor')
              OR EXISTS (
                  SELECT 1 FROM public.departments d
                  WHERE d.governorate = v_gov
                    AND (d.manager_id = v_actor_id OR d.deputy_manager_id = v_actor_id)
                    AND (d.name LIKE '%المالي والاداري%' OR d.name LIKE '%المالية والادارية%' OR d.name LIKE '%المالي والإداري%')
              )
          )
    ) INTO v_is_auth;

    IF NOT v_is_auth THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بمعالجة هذا الطلب');
    END IF;

    IF p_action = 'update_only' THEN
        v_eff_days := GREATEST(10, COALESCE(p_days_count, v_req.days_count));
        v_eff_pay := COALESCE(p_with_pay, v_req.with_pay, TRUE);
        v_eff_cadre := CASE WHEN p_cadre_type IN ('permanent', 'contract') THEN p_cadre_type ELSE COALESCE(v_req.cadre_type, 'permanent') END;
        v_eff_notes := COALESCE(NULLIF(TRIM(COALESCE(p_notes, '')), ''), v_req.reason);
        v_eff_cc := COALESCE(p_cc_recipients, v_req.cc_recipients, '{}'::TEXT[]);

        UPDATE public.leave_requests
        SET days_count = v_eff_days,
            with_pay = v_eff_pay,
            cadre_type = v_eff_cadre,
            reason = v_eff_notes,
            cc_recipients = v_eff_cc
        WHERE id = p_request_id;

        UPDATE public.system_notifications
        SET metadata = metadata || jsonb_build_object(
            'days_count', v_eff_days,
            'with_pay', v_eff_pay,
            'cadre_type', v_eff_cadre,
            'notes', COALESCE(v_eff_notes, ''),
            'cc_recipients', v_eff_cc
        )
        WHERE metadata->>'request_id' = p_request_id::text
          AND type = 'long_leave_finance';

        RETURN jsonb_build_object('success', true, 'message', 'تم حفظ التعديلات بنجاح');
    END IF;

    -- أرشفة إشعارات المالي والإداري وبديله
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'long_leave_finance';

    IF p_action = 'rejected' THEN
        UPDATE public.leave_requests
        SET status = 'rejected',
            leave_status = 'rejected',
            finance_status = 'rejected',
            finance_reviewer_id = v_actor_id,
            finance_reviewed_at = NOW(),
            is_read_by_employee = FALSE
        WHERE id = p_request_id;

        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_req.user_id, v_actor_id,
            'تم رفض طلب الإجازة الطويلة',
            format('تم رفض طلب الإجازة الاعتيادية الطويلة من قبل القسم المالي والإداري%s.',
                   CASE WHEN COALESCE(TRIM(p_notes), '') <> '' THEN ' للسبب: ' || TRIM(p_notes) ELSE '' END),
            'warning',
            jsonb_build_object('request_id', p_request_id, 'leave_type', 'long_regular'),
            NOW()
        );

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    IF p_action <> 'approved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
    END IF;

    v_eff_days := GREATEST(10, COALESCE(p_days_count, v_req.days_count));
    v_eff_pay := COALESCE(p_with_pay, v_req.with_pay, TRUE);
    v_eff_cadre := CASE WHEN p_cadre_type IN ('permanent', 'contract') THEN p_cadre_type ELSE COALESCE(v_req.cadre_type, 'permanent') END;
    v_eff_notes := COALESCE(NULLIF(TRIM(COALESCE(p_notes, '')), ''), v_req.reason);
    v_eff_cc := COALESCE(p_cc_recipients, v_req.cc_recipients, '{}'::TEXT[]);

    UPDATE public.leave_requests
    SET days_count = v_eff_days,
        with_pay = v_eff_pay,
        cadre_type = v_eff_cadre,
        reason = v_eff_notes,
        cc_recipients = v_eff_cc,
        finance_status = 'approved_for_print',
        finance_reviewer_id = v_actor_id,
        finance_reviewed_at = NOW()
    WHERE id = p_request_id;

    -- إرسال إشعار لموظفي الطابعة في المحافظة
    FOR v_printer IN
        SELECT id FROM public.profiles
        WHERE governorate = v_gov
          AND (is_printer_operator = TRUE OR has_printer_access = TRUE)
    LOOP
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_printer.id,
            v_actor_id,
            'أمر إجازة طويلة جاهز للطباعة',
            format('طلب إجازة اعتيادية طويلة للموظف (%s) لمدة (%s يوم - %s) جاهز للطباعة والإرسال للموارد البشرية.',
                   COALESCE(v_emp_name, 'موظف'), v_eff_days, CASE WHEN v_eff_pay THEN 'براتب تام' ELSE 'بدون راتب' END),
            'long_leave_print',
            jsonb_build_object(
                'request_id', p_request_id,
                'leave_type', 'long_regular',
                'employee_name', COALESCE(v_emp_name, 'موظف'),
                'days_count', v_eff_days,
                'with_pay', v_eff_pay,
                'cadre_type', v_eff_cadre
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'status', 'approved_for_print');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_long_leave_request_for_print(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID := auth.uid();
    v_req RECORD;
    v_emp RECORD;
    v_is_auth BOOLEAN := FALSE;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor_id
          AND (
              role = 'admin'
              OR admin_role IN ('hr', 'hr_supervisor', 'general', 'developer', 'finance')
              OR is_printer_operator = TRUE
              OR has_printer_access = TRUE
          )
    ) INTO v_is_auth;

    IF NOT v_is_auth THEN
        RAISE EXCEPTION 'غير مصرح لك بالوصول لبيانات الطباعة';
    END IF;

    SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    SELECT full_name, gender, dept_text, section_text, unit_text, job_number
    INTO v_emp
    FROM public.profiles WHERE id = v_req.user_id;

    RETURN jsonb_build_object(
        'success', true,
        'request', jsonb_build_object(
            'id', v_req.id,
            'user_id', v_req.user_id,
            'days_count', v_req.days_count,
            'with_pay', COALESCE(v_req.with_pay, TRUE),
            'cadre_type', COALESCE(v_req.cadre_type, 'permanent'),
            'cc_recipients', COALESCE(v_req.cc_recipients, '{}'::TEXT[]),
            'reason', v_req.reason,
            'is_printed', COALESCE(v_req.is_printed, FALSE),
            'employee', jsonb_build_object(
                'full_name', v_emp.full_name,
                'gender', v_emp.gender,
                'dept_text', v_emp.dept_text,
                'section_text', v_emp.section_text,
                'unit_text', v_emp.unit_text,
                'job_number', v_emp.job_number
            )
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_long_leave_printed(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID := auth.uid();
    v_req RECORD;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    -- القاعدة العامة للطباعة الأولى: إعادة الطباعة لا تغيّر شيئاً ولا ترسل إشعاراً
    IF COALESCE(v_req.is_printed, FALSE) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_printed', true,
            'message', 'تمت إعادة طباعة الأمر (موثّق مسبقاً دون إشعار إضافي)'
        );
    END IF;

    UPDATE public.leave_requests
    SET is_printed = TRUE,
        printed_by_id = v_actor_id,
        printed_at = NOW(),
        finance_status = 'printed'
    WHERE id = p_request_id;

    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'long_leave_print';

    INSERT INTO public.system_notifications (
        recipient_id, sender_id, title, content, type, metadata, created_at
    ) VALUES (
        v_req.user_id,
        v_actor_id,
        'تمت طباعة كتاب الإجازة الطويلة',
        'تمت طباعة كتاب إجازتك الطويلة وأُرسل إلى الموارد البشرية، يرجى المتابعة لإتمام براءة الذمة وتوقيع المدير وإصدار الأمر.',
        'success',
        jsonb_build_object('request_id', p_request_id, 'leave_type', 'long_regular', 'is_printed', true, 'printed_at', NOW()),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'already_printed', false, 'message', 'تم توثيق طباعة كتاب الإجازة الطويلة وإشعار صاحب الطلب بنجاح');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_long_leave_finance(uuid, text, integer, boolean, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_long_leave_request_for_print(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_long_leave_printed(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
