-- منظومة الإجازة الطويلة (> 9 أيام) + طلبات الانفكاك والمباشرة + حاوية المرفقات + منطق الطباعة الأولى العام
BEGIN;

-- =========================================================================
-- 1. السماح بتقديم الإجازة الطويلة (long_regular) بدون تاريخ بداية/مباشرة مسبق
-- =========================================================================
ALTER TABLE public.leave_requests
    ALTER COLUMN start_date DROP NOT NULL,
    ALTER COLUMN end_date DROP NOT NULL;

-- =========================================================================
-- 2. حاوية تخزين مرفقات كتب الإجازات لطلبات الانفكاك والمباشرة
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'leave-order-attachments',
    'leave-order-attachments',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'leave_order_attachments_read'
    ) THEN
        CREATE POLICY "leave_order_attachments_read"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'leave-order-attachments');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'leave_order_attachments_insert'
    ) THEN
        CREATE POLICY "leave_order_attachments_insert"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'leave-order-attachments' AND auth.uid() IS NOT NULL);
    END IF;
END $$;

-- =========================================================================
-- 3. جدول طلبات الانفكاك والمباشرة
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.hr_movement_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('disengagement', 'resumption')),
    reason_type TEXT NOT NULL DEFAULT 'long_leave',
    effective_date DATE NOT NULL,
    leave_order_number TEXT NOT NULL,
    leave_order_date DATE NOT NULL,
    attachment_url TEXT NOT NULL,
    with_pay BOOLEAN NOT NULL DEFAULT TRUE,
    linked_leave_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_finance'
        CHECK (status IN ('pending_finance', 'approved_for_print', 'completed', 'rejected')),
    finance_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    finance_reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    official_letter_number TEXT,
    official_letter_date DATE,
    is_printed BOOLEAN NOT NULL DEFAULT FALSE,
    printed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    printed_at TIMESTAMPTZ,
    governorate TEXT NOT NULL DEFAULT 'karbala',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hr_movement_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'hr_movement_requests'
          AND policyname = 'hr_movement_requests_select'
    ) THEN
        CREATE POLICY "hr_movement_requests_select"
        ON public.hr_movement_requests FOR SELECT
        TO authenticated
        USING (
            user_id = auth.uid()
            OR public.get_my_admin_role() IN ('developer', 'general', 'hr', 'hr_supervisor', 'finance', 'it_supervisor')
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND (p.is_printer_operator = TRUE OR p.has_printer_access = TRUE)
            )
            OR EXISTS (
                SELECT 1 FROM public.departments d
                WHERE d.governorate = hr_movement_requests.governorate
                  AND (d.manager_id = auth.uid() OR d.deputy_manager_id = auth.uid())
            )
        );
    END IF;
END $$;

-- =========================================================================
-- 4. تحديث handle_leave_state_machine لدعم الإجازة الطويلة بلا تاريخ حتى الانفكاك
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_leave_state_machine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_previous_balance INTEGER;
    v_new_balance INTEGER;
    v_leave_year INTEGER;
    v_action_type TEXT;
    v_paid_days INTEGER;
    v_unpaid_days INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' AND (
       (NEW.leave_status = 'approved' AND OLD.leave_status IS DISTINCT FROM 'approved') 
       OR (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved')
    ) THEN
        IF (auth.uid() != NEW.supervisor_id) AND (NOT public.is_privileged_user()) AND (COALESCE(NEW.is_mandatory, false) = false) THEN
            RAISE EXCEPTION 'Unauthorized';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' 
       AND NEW.status = OLD.status 
       AND NEW.leave_status = OLD.leave_status
       AND NEW.cancellation_status = OLD.cancellation_status 
       AND NEW.cut_status = OLD.cut_status
       AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    THEN
        RETURN NEW;
    END IF;

    IF NEW.leave_type IN ('dispatch', 'duty', 'time_off') THEN
        RETURN NEW;
    END IF;

    /* الإجازة الطويلة قبل تقديم وموافقة طلب الانفكاك (start_date IS NULL) لا تُخصم ولا تُدرج بعد */
    IF NEW.leave_type = 'long_regular' AND NEW.start_date IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.leave_type IN ('sick', 'long_sick') THEN
        SELECT sick_leaves_balance INTO v_previous_balance
        FROM public.financial_records WHERE user_id = NEW.user_id;
    ELSE
        SELECT remaining_leaves_balance INTO v_previous_balance
        FROM public.financial_records WHERE user_id = NEW.user_id;
    END IF;

    IF v_previous_balance IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على سجل مالي للموظف صاحب الطلب.';
    END IF;

    IF NEW.leave_type = 'unpaid' THEN
        v_paid_days := 0;
        v_unpaid_days := NEW.days_count;
    ELSE
        v_unpaid_days := COALESCE(NEW.unpaid_days, 0);
        v_paid_days := NEW.days_count - v_unpaid_days;
    END IF;

    -- القاعدة 1: الموافقة على الإجازة (أو تفعيل تاريخ الانفكاك للإجازة الطويلة)
    IF (
        (TG_OP = 'INSERT' AND NEW.leave_status = 'approved') OR
        (TG_OP = 'UPDATE' AND NEW.leave_status = 'approved' AND (OLD.leave_status IS DISTINCT FROM 'approved' OR OLD.start_date IS NULL))
       ) AND NEW.is_deducted = FALSE AND NEW.start_date IS NOT NULL THEN

        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance - v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = COALESCE(unpaid_leaves_total, 0) + v_unpaid_days WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := TRUE;
        v_leave_year := CAST(EXTRACT(YEAR FROM NEW.start_date) AS INTEGER);

        INSERT INTO public.leaves_details (user_id, year, leave_type, start_date, end_date, duration, created_at)
        VALUES (NEW.user_id, v_leave_year, 'normal', NEW.start_date, COALESCE(NEW.end_date, NEW.start_date), NEW.days_count, NOW());

        v_action_type := 'leave_approved';
        v_new_balance := v_previous_balance - v_paid_days;

    -- القاعدة 2: الموافقة على الإلغاء
    ELSIF TG_OP = 'UPDATE' AND (NEW.cancellation_status = 'approved' AND OLD.cancellation_status IS DISTINCT FROM 'approved') AND NEW.is_deducted = TRUE THEN
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        v_action_type := 'cancellation_approved';
        v_new_balance := v_previous_balance + v_paid_days;

    -- القاعدة 3: الرفض المتأخر بعد الخصم
    ELSIF TG_OP = 'UPDATE' AND (NEW.leave_status = 'rejected' AND OLD.leave_status IS DISTINCT FROM 'rejected') AND NEW.is_deducted = TRUE THEN
        IF NEW.leave_type IN ('sick', 'long_sick') THEN
            UPDATE public.financial_records SET sick_leaves_balance = sick_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        ELSIF NEW.leave_type IN ('regular', 'long_regular') THEN
            UPDATE public.financial_records SET remaining_leaves_balance = remaining_leaves_balance + v_paid_days WHERE user_id = NEW.user_id;
        END IF;

        IF v_unpaid_days > 0 THEN
            UPDATE public.financial_records SET unpaid_leaves_total = GREATEST(0, COALESCE(unpaid_leaves_total, 0) - v_unpaid_days) WHERE user_id = NEW.user_id;
        END IF;

        NEW.is_deducted := FALSE;
        DELETE FROM public.leaves_details WHERE user_id = NEW.user_id AND start_date = NEW.start_date AND duration = NEW.days_count;
        v_action_type := 'leave_rejected_after_deduction';
        v_new_balance := v_previous_balance + v_paid_days;
    END IF;

    IF v_action_type IS NOT NULL AND TG_OP = 'UPDATE' THEN
        INSERT INTO public.leave_history (leave_request_id, action_type, previous_balance, new_balance, actor_id, created_at)
        VALUES (NEW.id, v_action_type, v_previous_balance, v_new_balance, COALESCE(auth.uid(), NEW.user_id), NOW());
    END IF;

    RETURN NEW;
END;
$function$;

-- =========================================================================
-- 5. تحديث core_settle_request_approval لإرسال الإشعار الدقيق للإجازة الطويلة
-- =========================================================================
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
    v_action_ar TEXT;
    v_emp_title TEXT;
    v_emp_content TEXT;
BEGIN
    SELECT full_name INTO v_approver_name FROM public.profiles WHERE id = p_approver_id;

    SELECT user_id, leave_type, destination, start_date, end_date, days_count
    INTO v_requester_id, v_leave_type, v_destination, v_start_date, v_end_date, v_days_count
    FROM public.leave_requests WHERE id = p_request_id;

    IF v_requester_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'الطلب غير موجود');
    END IF;

    SELECT full_name, governorate INTO v_requester_name, v_gov
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
        v_emp_title := 'تمت الموافقة على إجازتك الطويلة';
        v_emp_content := format('تمت الموافقة على إجازتك الطويلة البالغة %s يوم، يرجى مراجعة الموارد البشرية لإتمام براءة الذمة وإصدار أمر الإجازة.',
                                COALESCE(v_days_count, 10));
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
            'notes', p_notes
        ),
        NOW()
    );

    RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- =========================================================================
-- 6. تحديث منطق الطباعة الأولى العام في mark_continuity_printed
--    الطباعة الأولى فقط توثق is_printed وترسل الإشعار؛ الإعادة لا تفعل شيئاً
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mark_continuity_printed(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID;
    v_req RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'طلب الاستمرارية غير موجود');
    END IF;

    -- القاعدة العامة: الطباعة الأولى فقط تؤثر وتُشعر؛ إعادة الطباعة لا تغيّر شيئاً ولا ترسل إشعاراً
    IF COALESCE(v_req.is_printed, FALSE) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_printed', true,
            'message', 'تمت إعادة طباعة الكتاب (موثّق مسبقاً دون إشعار إضافي)'
        );
    END IF;

    UPDATE public.service_continuity_requests
    SET is_printed = TRUE,
        printed_by_id = v_actor_id,
        printed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id;

    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'service_continuity_print';

    INSERT INTO public.system_notifications (
        recipient_id, sender_id, title, content, type, metadata, created_at
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
        'already_printed', false,
        'message', 'تم توثيق طباعة الكتاب وإشعار صاحب الطلب بنجاح'
    );
END;
$function$;

-- =========================================================================
-- 7. دوال طلبات الانفكاك والمباشرة (تقديم، معالجة المالي والإداري، جلب للطباعة، توثيق الطباعة الأولى)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_hr_movement_request(
    p_movement_type text,
    p_effective_date date,
    p_leave_order_number text,
    p_leave_order_date date,
    p_attachment_url text,
    p_with_pay boolean DEFAULT TRUE,
    p_linked_leave_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
    v_gov TEXT;
    v_finance_dept_id UUID;
    v_finance_manager_id UUID;
    v_finance_deputy_id UUID;
    v_req_id UUID;
    v_type_label TEXT;
    v_date_label TEXT;
    v_notif_body TEXT;
    v_meta JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم غير مسجل الدخول');
    END IF;

    IF p_movement_type NOT IN ('disengagement', 'resumption') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع الطلب غير صالح');
    END IF;

    IF p_effective_date IS NULL OR TRIM(COALESCE(p_leave_order_number, '')) = '' OR p_leave_order_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'يرجى إكمال كافة الحقول المطلوبة');
    END IF;

    IF TRIM(COALESCE(p_attachment_url, '')) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'تحميل صورة كتاب الإجازة إلزامي');
    END IF;

    SELECT full_name, COALESCE(governorate, 'karbala')
    INTO v_user_name, v_gov
    FROM public.profiles WHERE id = v_user_id;

    -- البحث عن مسؤول القسم المالي والإداري وبديله في المحافظة
    SELECT id, manager_id, deputy_manager_id
    INTO v_finance_dept_id, v_finance_manager_id, v_finance_deputy_id
    FROM public.departments
    WHERE governorate = v_gov
      AND (name LIKE '%المالي والاداري%' OR name LIKE '%المالية والادارية%' OR name LIKE '%المالي والإداري%')
    ORDER BY CASE WHEN name LIKE '%المالي والاداري%' THEN 1 ELSE 2 END ASC
    LIMIT 1;

    INSERT INTO public.hr_movement_requests (
        user_id, movement_type, reason_type, effective_date,
        leave_order_number, leave_order_date, attachment_url,
        with_pay, linked_leave_id, status, governorate
    ) VALUES (
        v_user_id, p_movement_type, 'long_leave', p_effective_date,
        TRIM(p_leave_order_number), p_leave_order_date, TRIM(p_attachment_url),
        COALESCE(p_with_pay, TRUE), p_linked_leave_id, 'pending_finance', v_gov
    ) RETURNING id INTO v_req_id;

    v_type_label := CASE WHEN p_movement_type = 'disengagement' THEN 'انفكاك' ELSE 'مباشرة' END;
    v_date_label := CASE WHEN p_movement_type = 'disengagement' THEN 'تاريخ الانفكاك' ELSE 'تاريخ المباشرة' END;
    v_notif_body := format(
        'قدم الموظف (%s) طلب (%s) لإجازة طويلة — %s: %s | حسب كتاب الإجازة المرقم (%s) بتاريخ (%s).',
        COALESCE(v_user_name, 'موظف'),
        v_type_label,
        v_date_label,
        p_effective_date::text,
        TRIM(p_leave_order_number),
        p_leave_order_date::text
    );

    v_meta := jsonb_build_object(
        'request_id', v_req_id,
        'movement_type', p_movement_type,
        'movement_label', v_type_label,
        'requester_id', v_user_id,
        'requester_name', COALESCE(v_user_name, 'موظف'),
        'effective_date', p_effective_date,
        'leave_order_number', TRIM(p_leave_order_number),
        'leave_order_date', p_leave_order_date,
        'attachment_url', TRIM(p_attachment_url),
        'with_pay', COALESCE(p_with_pay, TRUE)
    );

    IF v_finance_manager_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_finance_manager_id, v_user_id,
            format('طلب %s جديد (إجازة طويلة)', v_type_label),
            v_notif_body,
            'hr_movement_finance',
            v_meta,
            NOW()
        );
    END IF;

    IF v_finance_deputy_id IS NOT NULL AND v_finance_deputy_id IS DISTINCT FROM v_finance_manager_id THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_finance_deputy_id, v_user_id,
            format('طلب %s جديد (نسخة البديل)', v_type_label),
            v_notif_body,
            'hr_movement_finance',
            v_meta,
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'message', format('تم إرسال طلب الـ%s بنجاح إلى مسؤول القسم المالي والإداري وبديله.', v_type_label)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_hr_movement_finance(
    p_request_id uuid,
    p_action text,
    p_notes text DEFAULT NULL
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
    v_type_label TEXT;
    v_leave RECORD;
    v_actual_days INTEGER;
    v_refund_days INTEGER;
    v_printer RECORD;
    v_is_auth BOOLEAN := FALSE;
BEGIN
    IF v_actor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'المستخدم غير مسجل الدخول');
    END IF;

    SELECT * INTO v_req FROM public.hr_movement_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    IF v_req.status <> 'pending_finance' THEN
        RETURN jsonb_build_object('success', false, 'message', 'تمت معالجة هذا الطلب مسبقاً');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_actor_id
          AND (
              p.admin_role IN ('developer', 'general', 'finance', 'hr', 'hr_supervisor')
              OR EXISTS (
                  SELECT 1 FROM public.departments d
                  WHERE d.governorate = v_req.governorate
                    AND (d.manager_id = v_actor_id OR d.deputy_manager_id = v_actor_id)
                    AND (d.name LIKE '%المالي والاداري%' OR d.name LIKE '%المالية والادارية%' OR d.name LIKE '%المالي والإداري%')
              )
          )
    ) INTO v_is_auth;

    IF NOT v_is_auth THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بمعالجة هذا الطلب');
    END IF;

    SELECT full_name INTO v_emp_name FROM public.profiles WHERE id = v_req.user_id;
    v_type_label := CASE WHEN v_req.movement_type = 'disengagement' THEN 'انفكاك' ELSE 'مباشرة' END;

    -- أرشفة إشعارات المالي والإداري وبديله لهذا الطلب
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'hr_movement_finance';

    IF p_action = 'rejected' THEN
        UPDATE public.hr_movement_requests
        SET status = 'rejected',
            finance_reviewer_id = v_actor_id,
            finance_reviewed_at = NOW(),
            rejection_reason = NULLIF(TRIM(COALESCE(p_notes, '')), ''),
            updated_at = NOW()
        WHERE id = p_request_id;

        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_req.user_id, v_actor_id,
            format('تم رفض طلب الـ%s', v_type_label),
            format('تم رفض طلب %s للإجازة الطويلة%s.', v_type_label,
                   CASE WHEN COALESCE(TRIM(p_notes), '') <> '' THEN ' للسبب: ' || TRIM(p_notes) ELSE '' END),
            'warning',
            jsonb_build_object('request_id', p_request_id, 'movement_type', v_req.movement_type),
            NOW()
        );

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    IF p_action <> 'approved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
    END IF;

    -- عند الموافقة: تطبيق أثر الانفكاك أو المباشرة على الإجازة الطويلة والبصمة والرصيد
    IF v_req.movement_type = 'disengagement' THEN
        SELECT * INTO v_leave
        FROM public.leave_requests
        WHERE user_id = v_req.user_id
          AND leave_type = 'long_regular'
          AND status = 'approved'
          AND (id = v_req.linked_leave_id OR start_date IS NULL)
        ORDER BY (id = v_req.linked_leave_id) DESC, created_at DESC
        LIMIT 1;

        IF v_leave.id IS NOT NULL THEN
            UPDATE public.leave_requests
            SET start_date = v_req.effective_date,
                end_date = v_req.effective_date + GREATEST(0, COALESCE(v_leave.days_count, 10) - 1),
                with_pay = v_req.with_pay
            WHERE id = v_leave.id;

            UPDATE public.hr_movement_requests
            SET linked_leave_id = v_leave.id
            WHERE id = p_request_id;
        END IF;

    ELSIF v_req.movement_type = 'resumption' THEN
        SELECT * INTO v_leave
        FROM public.leave_requests
        WHERE user_id = v_req.user_id
          AND leave_type = 'long_regular'
          AND status = 'approved'
          AND start_date IS NOT NULL
          AND (hr_cut_status IS DISTINCT FROM 'approved')
        ORDER BY (id = v_req.linked_leave_id) DESC, start_date DESC
        LIMIT 1;

        IF v_leave.id IS NOT NULL THEN
            v_actual_days := GREATEST(0, (v_req.effective_date - v_leave.start_date));
            v_refund_days := GREATEST(0, COALESCE(v_leave.days_count, 0) - v_actual_days);

            UPDATE public.leave_requests
            SET cut_date = v_req.effective_date,
                hr_cut_status = 'approved',
                hr_refunded_days = v_refund_days
            WHERE id = v_leave.id;

            -- إرجاع الرصيد المتبقي عند قطع الإجازة المدفوعة
            IF v_refund_days > 0 AND COALESCE(v_leave.is_deducted, FALSE) = TRUE AND COALESCE(v_leave.with_pay, TRUE) = TRUE THEN
                UPDATE public.financial_records
                SET remaining_leaves_balance = COALESCE(remaining_leaves_balance, 0) + v_refund_days,
                    updated_at = NOW()
                WHERE user_id = v_req.user_id;
            END IF;

            UPDATE public.hr_movement_requests
            SET linked_leave_id = v_leave.id
            WHERE id = p_request_id;
        END IF;
    END IF;

    UPDATE public.hr_movement_requests
    SET status = 'approved_for_print',
        finance_reviewer_id = v_actor_id,
        finance_reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    -- إرسال إشعار لموظفي الطابعة في المحافظة
    FOR v_printer IN
        SELECT id FROM public.profiles
        WHERE governorate = v_req.governorate
          AND (is_printer_operator = TRUE OR has_printer_access = TRUE)
    LOOP
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, title, content, type, metadata, created_at
        ) VALUES (
            v_printer.id,
            v_actor_id,
            format('أمر إداري (%s) جاهز للطباعة', v_type_label),
            format('أمر إداري (%s) للموظف (%s) بتاريخ (%s) — استناداً لكتاب الإجازة المرقم (%s) في (%s).',
                   v_type_label, COALESCE(v_emp_name, 'موظف'), v_req.effective_date::text,
                   v_req.leave_order_number, v_req.leave_order_date::text),
            'hr_movement_print',
            jsonb_build_object(
                'request_id', p_request_id,
                'movement_type', v_req.movement_type,
                'movement_label', v_type_label,
                'employee_name', COALESCE(v_emp_name, 'موظف'),
                'effective_date', v_req.effective_date,
                'leave_order_number', v_req.leave_order_number,
                'leave_order_date', v_req.leave_order_date,
                'with_pay', v_req.with_pay
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'status', 'approved_for_print');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hr_movement_request_for_print(p_request_id uuid)
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

    SELECT * INTO v_req FROM public.hr_movement_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    SELECT full_name, gender, dept_text, section_text, unit_text, job_number
    INTO v_emp
    FROM public.profiles
    WHERE id = v_req.user_id;

    RETURN jsonb_build_object(
        'success', true,
        'request', jsonb_build_object(
            'id', v_req.id,
            'user_id', v_req.user_id,
            'movement_type', v_req.movement_type,
            'effective_date', v_req.effective_date,
            'leave_order_number', v_req.leave_order_number,
            'leave_order_date', v_req.leave_order_date,
            'with_pay', v_req.with_pay,
            'is_printed', v_req.is_printed,
            'status', v_req.status,
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

CREATE OR REPLACE FUNCTION public.mark_hr_movement_printed(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_actor_id UUID := auth.uid();
    v_req RECORD;
    v_type_label TEXT;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT * INTO v_req
    FROM public.hr_movement_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    -- القاعدة العامة للطباعة الأولى: إعادة الطباعة لا تغيّر الحالة ولا ترسل إشعاراً جديداً
    IF COALESCE(v_req.is_printed, FALSE) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_printed', true,
            'message', 'تمت إعادة الطباعة بنجاح (الأمر موثّق مسبقاً دون إرسال إشعار إضافي)'
        );
    END IF;

    v_type_label := CASE WHEN v_req.movement_type = 'disengagement' THEN 'انفكاك' ELSE 'مباشرة' END;

    UPDATE public.hr_movement_requests
    SET is_printed = TRUE,
        printed_by_id = v_actor_id,
        printed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id;

    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'hr_movement_print';

    INSERT INTO public.system_notifications (
        recipient_id, sender_id, title, content, type, metadata, created_at
    ) VALUES (
        v_req.user_id,
        v_actor_id,
        format('تم إصدار أمر %s', v_type_label),
        format('تم إصدار أمر %s وسيصلك بالبريد الداخلي بأقرب وقت.', v_type_label),
        'success',
        jsonb_build_object(
            'request_id', p_request_id,
            'movement_type', v_req.movement_type,
            'is_printed', true,
            'printed_at', NOW()
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_printed', false,
        'message', format('تم توثيق طباعة أمر %s وإشعار صاحب الطلب بنجاح', v_type_label)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_hr_movement_request(text, date, text, date, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_hr_movement_finance(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hr_movement_request_for_print(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_hr_movement_printed(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
