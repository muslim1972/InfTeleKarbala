-- ==============================================================================
-- الهجرة: 20261021000000_hr01_service_continuity_requests.sql
-- النواة المعمارية: BE-HR-01 (سجلات الموظفين والطلبات الإدارية)
-- الغرض: إنشاء جدول طلبات تأييد الاستمرارية بالخدمة المعزول تماماً،
-- ودوال سير العمل (المسؤول المباشر -> الموارد البشرية -> الإصدار والإرسال بالبريد الداخلي)
-- مع سياسات الأمان RLS والتكامل مع محرك الإشعارات وسجل التدقيق.
-- ==============================================================================

-- 1) جدول طلبات تأييد الاستمرارية بالخدمة المعزول (Domain-Isolated Table)
CREATE TABLE IF NOT EXISTS public.service_continuity_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    destination_entity TEXT NOT NULL,
    include_nominal_salary BOOLEAN NOT NULL DEFAULT FALSE,
    include_total_salary BOOLEAN NOT NULL DEFAULT FALSE,
    nominal_salary_snapshot NUMERIC(12, 2) DEFAULT 0,
    total_salary_snapshot NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,

    -- حالة دورة العمل (State Machine)
    status TEXT NOT NULL DEFAULT 'pending_supervisor',
    CONSTRAINT chk_service_continuity_status CHECK (
        status IN (
            'pending_supervisor',
            'rejected_by_supervisor',
            'pending_hr',
            'rejected_by_hr',
            'issued_and_dispatched'
        )
    ),

    -- اعتماد المسؤول المباشر
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    supervisor_decision_at TIMESTAMPTZ,
    supervisor_notes TEXT,

    -- معالجة وإصدار الموارد البشرية
    hr_processor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    hr_decision_at TIMESTAMPTZ,
    hr_notes TEXT,

    -- بيانات الكتاب الرسمي الصادر
    official_letter_number TEXT,
    official_letter_date DATE,
    work_location_id UUID REFERENCES public.work_locations(id) ON DELETE SET NULL,
    dispatch_notes TEXT,

    governorate TEXT NOT NULL DEFAULT 'karbala',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء
CREATE INDEX IF NOT EXISTS idx_sc_req_user_id ON public.service_continuity_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sc_req_status ON public.service_continuity_requests(status);
CREATE INDEX IF NOT EXISTS idx_sc_req_supervisor ON public.service_continuity_requests(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sc_req_gov ON public.service_continuity_requests(governorate);
CREATE INDEX IF NOT EXISTS idx_sc_req_created ON public.service_continuity_requests(created_at DESC);

-- تفعيل أمان مستوى الصف RLS
ALTER TABLE public.service_continuity_requests ENABLE ROW LEVEL SECURITY;

-- سياسات RLS
DROP POLICY IF EXISTS "Users can view own continuity requests" ON public.service_continuity_requests;
CREATE POLICY "Users can view own continuity requests"
ON public.service_continuity_requests
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR supervisor_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR admin_role IN ('general', 'developer', 'it_supervisor', 'hr', 'hr_supervisor'))
    )
);

DROP POLICY IF EXISTS "Users can insert own continuity requests" ON public.service_continuity_requests;
CREATE POLICY "Users can insert own continuity requests"
ON public.service_continuity_requests
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending_supervisor'
);

-- ==============================================================================
-- 2) دالة تقديم طلب تأييد الاستمرارية (Security Definer RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_service_continuity_request(
    p_destination_entity TEXT,
    p_include_nominal_salary BOOLEAN,
    p_include_total_salary BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_gov TEXT;
    v_work_loc UUID;
    v_nominal NUMERIC(12, 2) := 0;
    v_total NUMERIC(12, 2) := 0;
    v_supervisor_id UUID;
    v_req_id UUID;
    v_user_name TEXT;
    v_chain_rec RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    IF p_destination_entity IS NULL OR TRIM(p_destination_entity) = '' THEN
        RAISE EXCEPTION 'يرجى تحديد الجهة المعنون إليها الكتاب';
    END IF;

    -- جلب معلومات الموظف
    SELECT full_name, governorate 
    INTO v_user_name, v_gov
    FROM public.profiles
    WHERE id = v_user_id;

    v_work_loc := NULL;

    IF v_gov IS NULL THEN
        v_gov := 'karbala';
    END IF;

    -- سحب البيانات المالية المعتمدة إن طُلبت
    IF p_include_nominal_salary OR p_include_total_salary THEN
        SELECT 
            COALESCE(nominal_salary, 0),
            COALESCE(net_salary, gross_salary, nominal_salary, 0)
        INTO v_nominal, v_total
        FROM public.financial_records
        WHERE user_id = v_user_id
        LIMIT 1;
    END IF;

    IF NOT p_include_nominal_salary THEN
        v_nominal := 0;
    END IF;

    IF NOT p_include_total_salary THEN
        v_total := 0;
    END IF;

    -- تحديد المسؤول المباشر عبر محرك السلسلة الهرمية
    SELECT manager_id INTO v_supervisor_id
    FROM public.core_resolve_approval_chain(v_user_id)
    ORDER BY step_order ASC
    LIMIT 1;

    -- إدراج الطلب
    INSERT INTO public.service_continuity_requests (
        user_id,
        destination_entity,
        include_nominal_salary,
        include_total_salary,
        nominal_salary_snapshot,
        total_salary_snapshot,
        notes,
        status,
        supervisor_id,
        work_location_id,
        governorate
    ) VALUES (
        v_user_id,
        TRIM(p_destination_entity),
        p_include_nominal_salary,
        p_include_total_salary,
        v_nominal,
        v_total,
        p_notes,
        'pending_supervisor',
        v_supervisor_id,
        v_work_loc,
        v_gov
    ) RETURNING id INTO v_req_id;

    -- بث الإشعار في نفس الوقت لجميع المسؤولين في السلسلة حتى مدير القسم (قانون الإشعارات D15 / NTF-R01)
    FOR v_chain_rec IN 
        SELECT * FROM public.core_resolve_approval_chain(v_user_id) 
        ORDER BY step_order ASC 
    LOOP
        IF v_chain_rec.manager_id IS NOT NULL AND v_chain_rec.manager_id != v_user_id THEN
            INSERT INTO public.system_notifications (
                recipient_id,
                sender_id,
                title,
                content,
                type,
                metadata,
                created_at
            ) VALUES (
                v_chain_rec.manager_id,
                v_user_id,
                'طلب تأييد استمرارية بالخدمة جديد',
                format('قدّم الموظف (%s) طلباً لتأييد الاستمرارية بالخدمة معنوناً إلى: %s',
                       COALESCE(v_user_name, 'موظف'), TRIM(p_destination_entity)),
                'service_continuity_request',
                jsonb_build_object(
                    'request_id', v_req_id,
                    'request_type', 'service_continuity',
                    'continuity_step', 'supervisor',
                    'step_order', v_chain_rec.step_order,
                    'target_manager_name', v_chain_rec.manager_name,
                    'action_url', '/requests?request_id=' || v_req_id
                ),
                NOW()
            );
        END IF;
    END LOOP;

    -- تسجيل في سجل التدقيق
    INSERT INTO public.notification_audit_log (
        request_id,
        actor_id,
        action,
        action_details,
        governorate
    ) VALUES (
        v_req_id,
        v_user_id,
        'submitted_service_continuity',
        jsonb_build_object(
            'destination_entity', TRIM(p_destination_entity),
            'include_nominal', p_include_nominal_salary,
            'include_total', p_include_total_salary,
            'supervisor_id', v_supervisor_id
        ),
        v_gov
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req_id,
        'status', 'pending_supervisor',
        'message', 'تم تقديم طلب تأييد الاستمرارية بنجاح وإحالته للمسؤول المباشر'
    );
END;
$$;

-- ==============================================================================
-- 3) دالة قرار المسؤول المباشر (موافقة أو رفض)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_service_continuity_supervisor(
    p_request_id UUID,
    p_action TEXT, -- 'approve' | 'reject'
    p_notes TEXT DEFAULT NULL
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
    v_actor_name TEXT;
    v_requester_name TEXT;
    v_hr_rec RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    SELECT * INTO v_req
    FROM public.service_continuity_requests
    WHERE id = p_request_id;

    IF v_req.id IS NULL THEN
        RAISE EXCEPTION 'الطلب غير موجود';
    END IF;

    IF v_req.status != 'pending_supervisor' THEN
        RAISE EXCEPTION 'حالة الطلب الحالية لا تسمح باتخاذ قرار المسؤول (%s)', v_req.status;
    END IF;

    -- التحقق من الصلاحية: هل هو أي مسؤول في السلسلة الهرمية أو أدمن عام/مطور
    IF v_req.supervisor_id = v_actor_id THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.core_resolve_approval_chain(v_req.user_id)
            WHERE manager_id = v_actor_id
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            SELECT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = v_actor_id 
                AND (role = 'admin' OR admin_role IN ('general', 'developer', 'it_supervisor'))
            ) INTO v_is_authorized;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'غير مصرح لك باتخاذ قرار على هذا الطلب';
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    SELECT full_name INTO v_requester_name FROM public.profiles WHERE id = v_req.user_id;

    -- أ) اختفاء الإشعار من بقية المسؤولين في السلسلة (تحويله إلى مقروء وللعلم فقط)
    UPDATE public.system_notifications
    SET 
        type = 'fyi',
        is_read = TRUE,
        title = format('للعلم فقط: تم %s طلب التأييد', CASE WHEN p_action = 'approve' THEN 'الموافقة على' ELSE 'رفض' END),
        content = format('قام المسؤول (%s) بـ %s طلب تأييد الاستمرارية للموظف (%s)', 
                         COALESCE(v_actor_name, 'مسؤول'), 
                         CASE WHEN p_action = 'approve' THEN 'الموافقة على' ELSE 'رفض' END, 
                         COALESCE(v_requester_name, 'موظف')),
        metadata = metadata || jsonb_build_object(
            'fyi_action_by', COALESCE(v_actor_name, 'مسؤول'),
            'fyi_action', p_action,
            'is_actionable', FALSE
        )
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id <> v_actor_id;

    -- تعليم إشعار المسؤول الذي وافق/رفض كمقروء ومعالج
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id = v_actor_id;

    IF p_action = 'approve' THEN
        UPDATE public.service_continuity_requests
        SET 
            status = 'pending_hr',
            supervisor_id = v_actor_id,
            supervisor_decision_at = NOW(),
            supervisor_notes = p_notes,
            updated_at = NOW()
        WHERE id = p_request_id;

        -- إشعار للموظف باسم المسؤول الذي وافق
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
            'موافقة المسؤول على طلب التأييد',
            format('وافق المسؤول (%s) على طلب تأييد الاستمرارية، وأُحيل الطلب إلى شعبة الموارد البشرية لإصدار وتوقيع الكتاب أصولياً.',
                   COALESCE(v_actor_name, 'المسؤول')),
            'info',
            jsonb_build_object('request_id', p_request_id, 'status', 'pending_hr', 'approved_by', v_actor_name),
            NOW()
        );

        -- إشعار موجه حصراً لمسؤولي الموارد البشرية الفعليين في المحافظة حاملاً اسم المسؤول المعتمد
        FOR v_hr_rec IN 
            SELECT id FROM public.profiles 
            WHERE governorate = v_req.governorate 
            AND admin_role IN ('hr', 'hr_supervisor')
        LOOP
            INSERT INTO public.system_notifications (
                recipient_id,
                sender_id,
                title,
                content,
                type,
                metadata,
                created_at
            ) VALUES (
                v_hr_rec.id,
                v_actor_id,
                'طلب تأييد استمرارية جاهز للإصدار',
                format('وافق المسؤول (%s) على طلب تأييد الاستمرارية للموظف (%s) المعنون إلى: %s، وبانتظار الإصدار والتوقيع الأصولي.',
                       COALESCE(v_actor_name, 'المسؤول'), COALESCE(v_requester_name, 'موظف'), v_req.destination_entity),
                'service_continuity_hr_alert',
                jsonb_build_object('request_id', p_request_id, 'request_type', 'service_continuity', 'continuity_step', 'hr', 'action_url', '/admin/requests', 'approved_by', v_actor_name),
                NOW()
            );
        END LOOP;

    ELSIF p_action = 'reject' THEN
        UPDATE public.service_continuity_requests
        SET 
            status = 'rejected_by_supervisor',
            supervisor_id = v_actor_id,
            supervisor_decision_at = NOW(),
            supervisor_notes = p_notes,
            updated_at = NOW()
        WHERE id = p_request_id;

        -- إشعار بالرفض للموظف باسم المسؤول
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
            'رفض طلب تأييد الاستمرارية',
            format('تم رفض طلب تأييد الاستمرارية من قبل المسؤول (%s). السبب: %s',
                   COALESCE(v_actor_name, 'المسؤول'), COALESCE(p_notes, 'لم يحدد')),
            'warning',
            jsonb_build_object('request_id', p_request_id, 'status', 'rejected_by_supervisor', 'rejected_by', v_actor_name),
            NOW()
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
        'supervisor_decision_' || p_action,
        jsonb_build_object('notes', p_notes, 'previous_status', 'pending_supervisor'),
        v_req.governorate
    );

    RETURN jsonb_build_object('success', TRUE, 'action', p_action);
END;
$$;

-- ==============================================================================
-- 4) دالة إصدار الكتاب الرسمي وإرساله بالبريد الداخلي من الموارد البشرية
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_service_continuity_hr_issue(
    p_request_id UUID,
    p_action TEXT, -- 'issue' | 'reject'
    p_official_letter_number TEXT DEFAULT NULL,
    p_official_letter_date DATE DEFAULT NULL,
    p_dispatch_notes TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
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
        jsonb_build_object(
            'official_letter_number', p_official_letter_number,
            'official_letter_date', p_official_letter_date,
            'notes', p_notes
        ),
        v_req.governorate
    );

    RETURN jsonb_build_object('success', TRUE, 'action', p_action);
END;
$$;

-- منح الأذونات الآمنة للدوال
GRANT EXECUTE ON FUNCTION public.submit_service_continuity_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_service_continuity_supervisor TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_service_continuity_hr_issue TO authenticated;

-- منح الأذونات لجداول الإشعارات وسجل التدقيق والطلبات
GRANT ALL ON TABLE public.notification_audit_log TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.service_continuity_requests TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.system_notifications TO postgres, authenticated, service_role;

-- إسناد ملكية الدوال إلى المشرف الأعلى supabase_admin لضمان حق الإدراج في سجل التدقيق
ALTER FUNCTION public.submit_service_continuity_request(TEXT, BOOLEAN, BOOLEAN, TEXT) OWNER TO supabase_admin;
ALTER FUNCTION public.process_service_continuity_supervisor(UUID, TEXT, TEXT) OWNER TO supabase_admin;
ALTER FUNCTION public.process_service_continuity_hr_issue(UUID, TEXT, TEXT, DATE, TEXT, TEXT) OWNER TO supabase_admin;
