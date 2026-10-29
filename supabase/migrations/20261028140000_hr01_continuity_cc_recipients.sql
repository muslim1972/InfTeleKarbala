-- ==============================================================================
-- ترقية نظام كتب تأييد الاستمرارية بالخدمة: دعم جهات «نسخة منه إلى» (CC)
-- النواة المعمارية: BE-HR-01
-- التاريخ: 2026-10-28
-- ==============================================================================

-- 1. إضافة عمود cc_recipients لحفظ الجهات التي تستلم نسخة من الكتاب
ALTER TABLE public.service_continuity_requests 
ADD COLUMN IF NOT EXISTS cc_recipients TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.service_continuity_requests.cc_recipients IS 'قائمة الجهات الرسمية المعنون إليها نسخة من الكتاب للتفضل بالاطلاع مع التقدير';

-- 2. حذف الدالة السابقة بـ 6 معاملات لمنع أي تضارب overloads في PostgREST
DROP FUNCTION IF EXISTS public.process_service_continuity_hr_issue(UUID, TEXT, TEXT, DATE, TEXT, TEXT);

-- 3. إعادة إنشاء دالة إصدار الكتاب بـ 7 معاملات تتضمن p_cc_recipients
CREATE OR REPLACE FUNCTION public.process_service_continuity_hr_issue(
    p_request_id UUID,
    p_action TEXT, -- 'issue' | 'reject'
    p_official_letter_number TEXT DEFAULT NULL,
    p_official_letter_date DATE DEFAULT NULL,
    p_dispatch_notes TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_cc_recipients TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_actor_id UUID;
    v_is_hr BOOLEAN := FALSE;
    v_location_name TEXT := 'موقع العمل';
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- التحقق من صلاحية HR
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_actor_id 
        AND (role = 'admin' OR admin_role IN ('hr', 'hr_supervisor', 'general', 'developer'))
    ) INTO v_is_hr;

    IF NOT v_is_hr THEN
        RAISE EXCEPTION 'غير مصرح لك بإصدار كتب الموارد البشرية';
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'الطلب غير موجود';
    END IF;

    IF v_req.status != 'pending_hr' THEN
        RAISE EXCEPTION 'الطلب ليس في مرحلة الموارد البشرية الحالية (%s)', v_req.status;
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
            updated_at = NOW()
        WHERE id = p_request_id;

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
            'تم إصدار كتاب تأييد الاستمرارية بالعدد (' || TRIM(p_official_letter_number) || ') بتاريخ (' || p_official_letter_date::TEXT || ')، وهو في طريقه إليك عبر البريد الداخلي إلى (' || COALESCE(v_location_name, 'موقع عملك') || ') دون الحاجة للمراجعة الشخصية.',
            'success',
            jsonb_build_object(
                'request_id', p_request_id,
                'status', 'issued_and_dispatched',
                'letter_number', TRIM(p_official_letter_number),
                'letter_date', p_official_letter_date
            )
        );

    ELSIF p_action = 'reject' THEN
        UPDATE public.service_continuity_requests
        SET 
            status = 'rejected_by_hr',
            hr_processor_id = v_actor_id,
            hr_decision_at = NOW(),
            hr_notes = p_notes,
            updated_at = NOW()
        WHERE id = p_request_id;

        -- إشعار بالرفض
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
            'اعتذار الموارد البشرية عن إصدار كتاب التأييد',
            'تعذر إصدار كتاب تأييد الاستمرارية من قبل الموارد البشرية. السبب: ' || COALESCE(p_notes, 'لم يحدد'),
            'warning',
            jsonb_build_object('request_id', p_request_id, 'status', 'rejected_by_hr')
        );
    ELSE
        RAISE EXCEPTION 'إجراء غير صالح: %s', p_action;
    END IF;

    -- سجل التدقيق
    INSERT INTO public.notification_audit_log (
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

-- 4. الصلاحيات وإسناد الملكية
GRANT EXECUTE ON FUNCTION public.process_service_continuity_hr_issue(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT[]) TO authenticated;
ALTER FUNCTION public.process_service_continuity_hr_issue(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT[]) OWNER TO supabase_admin;

-- 5. إشعار PostgREST بتحديث المخطط فوراً
NOTIFY pgrst, 'reload schema';
