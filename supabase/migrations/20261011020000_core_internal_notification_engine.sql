-- ==============================================================================
-- الهجرة: 20261011020000_core_internal_notification_engine.sql
-- الطابوقة: BE-CORE-04 (الإشعارات)
-- الغرض: بناء محرك الإشعارات الداخلية الموحد، صعود السلسلة الهرمية حتى مدير القسم،
-- تحويل الإشعارات للعلم فقط، إشعار صاحب الطلب، ومشرفي البصمة و HR، مع عزل المحافظات الـ 16
-- المرجع المعماري: bricks/CORE-BRAIN.md (NTF-R01..09) ووثيقة قانون الإشعارات D15
-- ==============================================================================

-- 1) جدول سجل حركات الإشعارات (Audit Trail غير قابل للتعديل) NTF-R06
CREATE TABLE IF NOT EXISTS public.notification_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.system_notifications(id) ON DELETE SET NULL,
    request_id UUID,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'dispatched', 'viewed', 'approved', 'rejected', 'fyi_dismissed'
    action_details JSONB DEFAULT '{}'::jsonb,
    governorate TEXT NOT NULL DEFAULT 'karbala',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_audit_req ON public.notification_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_notif_audit_actor ON public.notification_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_notif_audit_gov ON public.notification_audit_log(governorate);

-- تفعيل RLS على سجل التدقيق
ALTER TABLE public.notification_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit log for their requests or actions" ON public.notification_audit_log;
CREATE POLICY "Users can view audit log for their requests or actions"
ON public.notification_audit_log
FOR SELECT
TO authenticated
USING (
    actor_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR admin_role IN ('general', 'developer', 'it_supervisor', 'hr', 'hr_supervisor'))
    )
);

-- 2) دالة استخراج سلسلة المسؤولين الهرمية (صعود حتى مدير القسم أو رأس الهرم) NTF-R01/02/08
CREATE OR REPLACE FUNCTION public.core_resolve_approval_chain(p_user_id UUID)
RETURNS TABLE (
    manager_id UUID,
    manager_name TEXT,
    dept_id UUID,
    dept_name TEXT,
    dept_level INTEGER,
    step_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dept_id UUID;
    v_curr_dept_id UUID;
    v_gov TEXT;
    v_visited UUID[] := '{}';
    v_step INTEGER := 1;
    v_mgr_id UUID;
    v_mgr_name TEXT;
    v_parent_id UUID;
    v_lvl INTEGER;
    v_dname TEXT;
    v_is_top_self BOOLEAN := FALSE;
BEGIN
    -- جلب قسم ومحافظة الموظف
    SELECT department_id, governorate INTO v_dept_id, v_gov
    FROM public.profiles WHERE id = p_user_id;

    IF v_dept_id IS NULL THEN
        RETURN;
    END IF;

    v_curr_dept_id := v_dept_id;

    WHILE v_curr_dept_id IS NOT NULL AND NOT (v_curr_dept_id = ANY(v_visited)) LOOP
        v_visited := array_append(v_visited, v_curr_dept_id);

        SELECT id, name, manager_id, parent_id, level
        INTO v_curr_dept_id, v_dname, v_mgr_id, v_parent_id, v_lvl
        FROM public.departments
        WHERE id = v_curr_dept_id;

        IF NOT FOUND THEN
            EXIT;
        END IF;

        -- إذا كان المسؤول موجوداً وليس هو الموظف صاحب الطلب
        IF v_mgr_id IS NOT NULL AND v_mgr_id <> p_user_id THEN
            SELECT full_name INTO v_mgr_name FROM public.profiles WHERE id = v_mgr_id;
            
            manager_id := v_mgr_id;
            manager_name := COALESCE(v_mgr_name, 'مسؤول');
            dept_id := v_curr_dept_id;
            dept_name := v_dname;
            dept_level := v_lvl;
            step_order := v_step;
            
            RETURN NEXT;
            v_step := v_step + 1;

        ELSIF v_mgr_id = p_user_id AND v_parent_id IS NULL THEN
            -- رأس الهرم (مدير المديرية ليس له أب) NTF-R08
            v_is_top_self := TRUE;
        END IF;

        -- التوقف عند بلوغ مستوى مدير القسم (level <= 3) شرط ألا يكون صاحب الطلب هو مدير القسم
        IF v_lvl <= 3 AND v_mgr_id <> p_user_id THEN
            EXIT;
        END IF;

        v_curr_dept_id := v_parent_id;
    END LOOP;

    -- إذا كان الموظف هو رأس الهرم بذاته ولم يضف أي مسؤول
    IF v_is_top_self AND v_step = 1 THEN
        SELECT full_name INTO v_mgr_name FROM public.profiles WHERE id = p_user_id;
        manager_id := p_user_id;
        manager_name := COALESCE(v_mgr_name, 'المدير العام');
        dept_id := v_dept_id;
        dept_name := 'الإدارة العليا';
        dept_level := 1;
        step_order := 1;
        RETURN NEXT;
    END IF;

    RETURN;
END;
$$;

-- 3) دالة إطلاق إشعارات الطلب الجديد لسلسلة المسؤولين بالكامل NTF-R01 / NTF-R02
CREATE OR REPLACE FUNCTION public.core_dispatch_request_notifications(
    p_request_id UUID,
    p_requester_id UUID,
    p_request_title TEXT,
    p_request_details TEXT,
    p_request_type TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
    v_requester_name TEXT;
    v_gov TEXT;
    v_notif_id UUID;
    v_count INTEGER := 0;
BEGIN
    SELECT full_name, governorate INTO v_requester_name, v_gov
    FROM public.profiles WHERE id = p_requester_id;

    -- إرسال الإشعار لكل مسؤول في السلسلة (الوحدة -> الشعبة -> القسم)
    FOR r IN SELECT * FROM public.core_resolve_approval_chain(p_requester_id) ORDER BY step_order ASC LOOP
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            type,
            title,
            content,
            is_read,
            metadata,
            created_at
        ) VALUES (
            r.manager_id,
            p_requester_id,
            'leave_request',
            p_request_title,
            format('قدم الموظف (%s) %s في قسم (%s)', COALESCE(v_requester_name, 'موظف'), p_request_details, r.dept_name),
            FALSE,
            p_metadata || jsonb_build_object(
                'request_id', p_request_id,
                'step_order', r.step_order,
                'target_manager_name', r.manager_name,
                'governorate', v_gov,
                'is_actionable', TRUE
            ),
            NOW()
        ) RETURNING id INTO v_notif_id;

        -- تسجيل في الـ audit log
        INSERT INTO public.notification_audit_log (
            notification_id,
            request_id,
            actor_id,
            action,
            action_details,
            governorate
        ) VALUES (
            v_notif_id,
            p_request_id,
            r.manager_id,
            'dispatched',
            jsonb_build_object('step_order', r.step_order, 'manager_name', r.manager_name),
            v_gov
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', TRUE, 'notified_count', v_count);
END;
$$;

-- 4) دالة تحويل الإشعارات للعلم فقط وإشعار الموظف ومشرفي البصمة والـ HR بعد الموافقة NTF-R03/04/05
CREATE OR REPLACE FUNCTION public.core_settle_request_approval(
    p_request_id UUID,
    p_approver_id UUID,
    p_action TEXT, -- 'approved' أو 'rejected'
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_approver_name TEXT;
    v_requester_id UUID;
    v_requester_name TEXT;
    v_gov TEXT;
    v_leave_type TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_days_count INTEGER;
    v_notif_id UUID;
    v_hr RECORD;
    v_bio RECORD;
    v_action_ar TEXT;
BEGIN
    SELECT full_name INTO v_approver_name FROM public.profiles WHERE id = p_approver_id;
    
    SELECT user_id, leave_type, start_date, end_date, days_count 
    INTO v_requester_id, v_leave_type, v_start_date, v_end_date, v_days_count
    FROM public.leave_requests WHERE id = p_request_id;

    IF v_requester_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'الطلب غير موجود');
    END IF;

    SELECT full_name, governorate INTO v_requester_name, v_gov
    FROM public.profiles WHERE id = v_requester_id;

    v_action_ar := CASE WHEN p_action = 'approved' THEN 'الموافقة على' ELSE 'رفض' END;

    -- =========================================================================
    -- أ) تحويل إشعارات بقية المسؤولين في السلسلة إلى (للعلم فقط) NTF-R03
    -- =========================================================================
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

    -- تعليم إشعار المسؤول الذي وافق/رفض كمقروء ومعالج
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id = p_approver_id;

    -- =========================================================================
    -- ب) إرسال إشعار فوري للموظف صاحب الطلب بنتيجة الإجراء NTF-R04
    -- =========================================================================
    INSERT INTO public.system_notifications (
        recipient_id,
        sender_id,
        type,
        title,
        content,
        is_read,
        metadata,
        created_at
    ) VALUES (
        v_requester_id,
        p_approver_id,
        'leave_response',
        format('تم %s طلبك', v_action_ar),
        format('قام المسؤول (%s) بـ %s طلب إجازتك للفترة من (%s) إلى (%s)', COALESCE(v_approver_name, 'المسؤول'), v_action_ar, v_start_date, v_end_date),
        FALSE,
        jsonb_build_object(
            'request_id', p_request_id,
            'action', p_action,
            'action_by', v_approver_name,
            'can_acknowledge', TRUE
        ),
        NOW()
    );

    -- =========================================================================
    -- ج) في حال الموافقة: إشعار مشرف البصمة ومشرف الموارد البشرية (HR) للتوثيق NTF-R05
    -- =========================================================================
    IF p_action = 'approved' THEN
        -- مشرفو الموارد البشرية في نفس المحافظة
        FOR v_hr IN 
            SELECT id FROM public.profiles 
            WHERE governorate = v_gov 
              AND (role = 'admin' OR admin_role IN ('hr', 'hr_supervisor'))
        LOOP
            INSERT INTO public.system_notifications (
                recipient_id,
                sender_id,
                type,
                title,
                content,
                is_read,
                metadata,
                created_at
            ) VALUES (
                v_hr.id,
                p_approver_id,
                'leave_hr',
                'طلب إجازة معتمد للتوثيق والطباعة',
                format('تمت موافقة (%s) على إجازة الموظف (%s) للفترة (%s إلى %s). يرجى التوثيق.', COALESCE(v_approver_name, 'مسؤول'), COALESCE(v_requester_name, 'موظف'), v_start_date, v_end_date),
                FALSE,
                jsonb_build_object('request_id', p_request_id, 'for_documentation', TRUE, 'governorate', v_gov),
                NOW()
            );
        END LOOP;

        -- مشرفو البصمة في نفس المحافظة
        FOR v_bio IN 
            SELECT id FROM public.profiles 
            WHERE governorate = v_gov 
              AND admin_role IN ('biometric', 'attendance_supervisor')
        LOOP
            INSERT INTO public.system_notifications (
                recipient_id,
                sender_id,
                type,
                title,
                content,
                is_read,
                metadata,
                created_at
            ) VALUES (
                v_bio.id,
                p_approver_id,
                'biometric_alert',
                'إشعار إجازة معتمدة (مسؤول البصمة)',
                format('تم اعتماد إجازة للموظف (%s) للفترة (%s إلى %s) لعلم مسؤول البصمة.', COALESCE(v_requester_name, 'موظف'), v_start_date, v_end_date),
                FALSE,
                jsonb_build_object('request_id', p_request_id, 'for_attendance', TRUE, 'governorate', v_gov),
                NOW()
            );
        END LOOP;
    END IF;

    -- =========================================================================
    -- د) توثيق الحدث في سجل حركات الإشعارات NTF-R06
    -- =========================================================================
    INSERT INTO public.notification_audit_log (
        request_id,
        actor_id,
        action,
        action_details,
        governorate
    ) VALUES (
        p_request_id,
        p_approver_id,
        p_action,
        jsonb_build_object('approver_name', v_approver_name, 'notes', p_notes),
        v_gov
    );

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 5) منح الصلاحيات للمستخدمين المسجلين فقط
REVOKE ALL ON FUNCTION public.core_resolve_approval_chain(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_resolve_approval_chain(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.core_dispatch_request_notifications(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_dispatch_request_notifications(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.core_settle_request_approval(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_settle_request_approval(UUID, UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
