-- ============================================================================
-- ترقية ذكاء طلبات الواجب الرسمي وإشعاراتها ومنع التضارب وإصلاح شريط الأخبار
-- 1. إسقاط النسخ المتضاربة لـ submit_typed_leave_request وتوحيدها في دالة وحيدة (16 معاملاً)
-- 2. تحديث core_settle_request_approval: صياغة واجب خاصة + حصر إشعارات HR بأهل الاختصاص
-- 3. فتح قراءة admin_tips لجميع المستخدمين لضمان ظهور شريط الأخبار دائماً
-- ============================================================================

-- إسقاط النسختين السابقتين لمنع أي التباس في Postgres و PostgREST
DROP FUNCTION IF EXISTS public.submit_typed_leave_request(TEXT, DATE, DATE, INTEGER, TEXT, UUID, UUID[], INTEGER, TEXT, BOOLEAN, TEXT[], TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.submit_typed_leave_request(TEXT, DATE, DATE, INTEGER, TEXT, UUID, UUID[], INTEGER, TEXT, BOOLEAN, TEXT[], TEXT, BOOLEAN, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, UUID);

-- 1) دالة تقديم الطلبات الموحدة (16 معاملاً) مع منع التضارب وصياغة الإشعارات الذكية ودعم الموظف البديل
CREATE OR REPLACE FUNCTION public.submit_typed_leave_request(
    p_leave_type TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_days_count INTEGER,
    p_reason TEXT,
    p_supervisor_id UUID,
    p_approval_chain UUID[],
    p_time_duration_minutes INTEGER DEFAULT NULL,
    p_destination TEXT DEFAULT NULL,
    p_with_pay BOOLEAN DEFAULT true,
    p_supporting_image_urls TEXT[] DEFAULT '{}',
    p_time_off_subtype TEXT DEFAULT NULL,
    p_with_request BOOLEAN DEFAULT true,
    p_leave_start_time TIME WITHOUT TIME ZONE DEFAULT NULL,
    p_leave_end_time TIME WITHOUT TIME ZONE DEFAULT NULL,
    p_substitute_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_request_id uuid;
    v_subtype_label TEXT;
    v_notif_title TEXT;
    v_notif_content TEXT;
    v_user_name TEXT;
    v_conflict_rec RECORD;
    v_sub_status TEXT := 'none';
BEGIN
    /* التحقق من نوع الإجازة أو الطلب */
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع طلب غير صالح');
    END IF;

    /* التحقق من نوع الزمنية الفرعي */
    IF p_time_off_subtype IS NOT NULL AND p_time_off_subtype NOT IN ('mid_shift', 'shift_start', 'shift_end') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع زمنية فرعي غير صالح');
    END IF;

    /* التحقق من الموظف البديل عند تحديده */
    IF p_substitute_id IS NOT NULL THEN
        IF p_substitute_id = auth.uid() THEN
            RETURN jsonb_build_object('success', false, 'message', 'لا يمكنك اختيار نفسك كموظف بديل');
        END IF;
        v_sub_status := 'pending';
    END IF;

    /* =========================================================================
       منع التضارب الذكي (Conflict Detection Safeguard)
       ========================================================================= */
    IF p_leave_type = 'duty' THEN
        -- 1. فحص التضارب مع إجازة كاملة في نفس تاريخ الواجب
        SELECT id, leave_type, status INTO v_conflict_rec
        FROM public.leave_requests
        WHERE user_id = auth.uid()
          AND status IN ('pending', 'approved')
          AND leave_type NOT IN ('duty', 'time_off')
          AND p_start_date >= start_date AND p_start_date <= end_date
        LIMIT 1;

        IF v_conflict_rec.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'لا يمكن تقديم واجب رسمي في هذا اليوم، لأن لديك طلب إجازة (' || 
                           CASE v_conflict_rec.leave_type 
                               WHEN 'regular' THEN 'اعتيادية'
                               WHEN 'sick' THEN 'مرضية'
                               WHEN 'long_regular' THEN 'خمس سنوات'
                               ELSE v_conflict_rec.leave_type 
                           END || ') ' || 
                           CASE WHEN v_conflict_rec.status = 'approved' THEN 'معتمد' ELSE 'قيد المراجعة' END || 
                           ' في نفس التاريخ.'
            );
        END IF;

        -- 2. فحص التضارب مع واجب رسمي آخر في نفس التاريخ
        SELECT id, destination, status INTO v_conflict_rec
        FROM public.leave_requests
        WHERE user_id = auth.uid()
          AND status IN ('pending', 'approved')
          AND leave_type = 'duty'
          AND start_date = p_start_date
        LIMIT 1;

        IF v_conflict_rec.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'لديك بالفعل واجب رسمي إلى (' || COALESCE(v_conflict_rec.destination, 'جهة رسمية') || ') ' ||
                           CASE WHEN v_conflict_rec.status = 'approved' THEN 'معتمد' ELSE 'قيد المراجعة' END ||
                           ' في تاريخ ' || p_start_date || '. لا يمكن تكرار الواجب في نفس اليوم.'
            );
        END IF;

        -- 3. فحص التضارب مع إجازة زمنية في نفس التاريخ
        SELECT id, time_off_subtype, time_duration_minutes, status INTO v_conflict_rec
        FROM public.leave_requests
        WHERE user_id = auth.uid()
          AND status IN ('pending', 'approved')
          AND leave_type = 'time_off'
          AND start_date = p_start_date
        LIMIT 1;

        IF v_conflict_rec.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'لديك إجازة زمنية (' || COALESCE(v_conflict_rec.time_duration_minutes, 0) || ' دقيقة) ' ||
                           CASE WHEN v_conflict_rec.status = 'approved' THEN 'معتمدة' ELSE 'قيد المراجعة' END ||
                           ' في تاريخ ' || p_start_date || '. يرجى مراجعة وتصفية طلباتك السابقة أولاً.'
            );
        END IF;
    END IF;

    /* جلب اسم الموظف */
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

    /* إدراج الطلب */
    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, leave_start_time, leave_end_time,
        substitute_id, substitute_status, created_at
    ) VALUES (
        auth.uid(), p_leave_type, p_start_date, p_end_date, p_days_count, p_reason,
        p_supervisor_id, p_approval_chain, p_time_duration_minutes, p_destination,
        p_with_pay, p_supporting_image_urls, 'pending', 'pending',
        p_time_off_subtype, p_with_request, p_leave_start_time, p_leave_end_time,
        p_substitute_id, v_sub_status, NOW()
    ) RETURNING id INTO v_new_request_id;

    /* تسمية نوع الطلب للإشعارات */
    IF p_leave_type = 'time_off' THEN
        v_subtype_label := CASE p_time_off_subtype
            WHEN 'mid_shift' THEN 'وسط الدوام'
            WHEN 'shift_start' THEN 'بداية الدوام'
            WHEN 'shift_end' THEN 'نهاية الدوام'
            ELSE 'زمنية'
        END;
    ELSE
        v_subtype_label := CASE p_leave_type
            WHEN 'regular' THEN 'اعتيادية'
            WHEN 'sick' THEN 'مرضية'
            WHEN 'duty' THEN 'واجب رسمي'
            WHEN 'dispatch' THEN 'إيفاد'
            WHEN 'long_regular' THEN 'خمس سنوات'
            ELSE p_leave_type
        END;
    END IF;

    /* مسار الإشعار: للموظف البديل أولاً إن وُجد، أو للمسؤول المباشر مباشرة */
    IF p_substitute_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            p_substitute_id, auth.uid(), 'substitute_request',
            '📋 طلب تكليف كبديل لموظف مجاز',
            'طلب منك الزميل (' || COALESCE(v_user_name, 'موظف') || ') أن تكون بديلاً عنه أثناء إجازته (' || v_subtype_label || ') لتاريخ ' || p_start_date::text || '. يرجى الموافقة أو الاعتذار.',
            jsonb_build_object(
                'request_id', v_new_request_id,
                'leave_type', p_leave_type,
                'time_off_subtype', p_time_off_subtype,
                'start_date', p_start_date,
                'end_date', p_end_date,
                'requester_id', auth.uid(),
                'requester_name', COALESCE(v_user_name, 'موظف'),
                'is_substitute_action', true
            ),
            NOW()
        );
    ELSE
        -- إشعار صريح للمسؤول المباشر
        IF p_leave_type = 'duty' THEN
            v_notif_title := 'طلب تنفيذ واجب رسمي';
            v_notif_content := 'الموظف: (' || COALESCE(v_user_name, 'موظف') || ') يطلب الموافقة على الخروج لتنفيذ واجب رسمي إلى (' || COALESCE(p_destination, 'جهة غير محددة') || ').' || E'\n' || COALESCE(p_reason, '');
        ELSIF p_leave_type = 'time_off' THEN
            v_notif_title := 'طلب إجازة زمنية — ' || v_subtype_label;
            v_notif_content := 'الموظف: (' || COALESCE(v_user_name, 'موظف') || ') يطلب إجازة زمنية (' || v_subtype_label || ') بمدة ' || COALESCE(p_time_duration_minutes, 0) || ' دقيقة.' || E'\n' || COALESCE(p_reason, '');
        ELSE
            v_notif_title := 'طلب إجازة جديد';
            v_notif_content := 'الموظف: (' || COALESCE(v_user_name, 'موظف') || ') يطلب إجازة بانتظار موافقتك للفترة (' || p_start_date || ' إلى ' || p_end_date || ').' || E'\n' || COALESCE(p_reason, '');
        END IF;

        IF p_supervisor_id IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                p_supervisor_id, auth.uid(), 'leave_request',
                v_notif_title, v_notif_content,
                jsonb_build_object(
                    'request_id', v_new_request_id,
                    'leave_type', p_leave_type,
                    'employee_name', COALESCE(v_user_name, 'موظف'),
                    'destination', p_destination,
                    'time_off_subtype', p_time_off_subtype,
                    'with_request', p_with_request
                ),
                NOW()
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE 
            WHEN p_substitute_id IS NOT NULL THEN 'تم إرسال طلب التكليف للموظف البديل بانتظار موافقته.' 
            WHEN p_leave_type = 'duty' THEN 'تم تقديم طلب الواجب بنجاح وإرساله للمسؤول.'
            ELSE 'تم تقديم طلب الإجازة بنجاح.' 
        END,
        'request_id', v_new_request_id,
        'waiting_for_substitute', (p_substitute_id IS NOT NULL)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_typed_leave_request(TEXT, DATE, DATE, INTEGER, TEXT, UUID, UUID[], INTEGER, TEXT, BOOLEAN, TEXT[], TEXT, BOOLEAN, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_typed_leave_request(TEXT, DATE, DATE, INTEGER, TEXT, UUID, UUID[], INTEGER, TEXT, BOOLEAN, TEXT[], TEXT, BOOLEAN, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE, UUID) TO authenticated;


-- 2) دالة تسوية الموافقات core_settle_request_approval مع تمييز الواجب وحصر إشعارات HR
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
    v_destination TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_days_count INTEGER;
    v_hr RECORD;
    v_bio RECORD;
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

    -- =========================================================================
    -- أ) تحويل إشعارات بقية المسؤولين في السلسلة إلى (للعلم فقط)
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
    -- ب) إرسال إشعار فوري للموظف صاحب الطلب بنتيجة الإجراء بدقة
    -- =========================================================================
    IF v_leave_type = 'duty' THEN
        v_emp_title := format('تم %s طلب الواجب الرسمي', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب خروجك لتنفيذ واجب رسمي إلى (%s) بتاريخ (%s).', 
                                COALESCE(v_approver_name, 'المسؤول'), 
                                v_action_ar, 
                                COALESCE(v_destination, 'الجهة المحددة'), 
                                v_start_date);
    ELSIF v_leave_type = 'time_off' THEN
        v_emp_title := format('تم %s طلب الإجازة الزمنية', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب إجازتك الزمنية بتاريخ (%s).', 
                                COALESCE(v_approver_name, 'المسؤول'), 
                                v_action_ar, 
                                v_start_date);
    ELSE
        v_emp_title := format('تم %s طلب الإجازة', v_action_ar);
        v_emp_content := format('قام المسؤول (%s) بـ %s طلب إجازتك للفترة من (%s) إلى (%s).', 
                                COALESCE(v_approver_name, 'المسؤول'), 
                                v_action_ar, 
                                v_start_date, 
                                v_end_date);
    END IF;

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
        v_emp_title,
        v_emp_content,
        FALSE,
        jsonb_build_object(
            'request_id', p_request_id,
            'leave_type', v_leave_type,
            'action', p_action,
            'action_by', v_approver_name,
            'destination', v_destination,
            'can_acknowledge', TRUE
        ),
        NOW()
    );

    -- =========================================================================
    -- ج) في حال الموافقة: إشعار مسؤول البصمة ومسؤول الـ HR المختص
    -- =========================================================================
    IF p_action = 'approved' THEN
        -- مشرفو الموارد البشرية الحصريون فقط (دون إرسال عشوائي لكافة المشرفين)
        FOR v_hr IN 
            SELECT id FROM public.profiles 
            WHERE governorate = v_gov 
              AND admin_role IN ('hr', 'hr_supervisor')
        LOOP
            IF v_leave_type = 'duty' THEN
                INSERT INTO public.system_notifications (
                    recipient_id, sender_id, type, title, content, is_read, metadata, created_at
                ) VALUES (
                    v_hr.id,
                    p_approver_id,
                    'leave_hr',
                    'طلب واجب رسمي معتمد للتوثيق',
                    format('تمت موافقة (%s) على واجب رسمي للموظف (%s) إلى (%s) بتاريخ (%s). يرجى التوثيق الإداري.', 
                           COALESCE(v_approver_name, 'مسؤول'), 
                           COALESCE(v_requester_name, 'موظف'), 
                           COALESCE(v_destination, 'جهة رسمية'), 
                           v_start_date),
                    FALSE,
                    jsonb_build_object('request_id', p_request_id, 'leave_type', 'duty', 'for_documentation', TRUE, 'governorate', v_gov),
                    NOW()
                );
            ELSE
                INSERT INTO public.system_notifications (
                    recipient_id, sender_id, type, title, content, is_read, metadata, created_at
                ) VALUES (
                    v_hr.id,
                    p_approver_id,
                    'leave_hr',
                    'طلب إجازة معتمد للتوثيق والطباعة',
                    format('تمت موافقة (%s) على إجازة الموظف (%s) للفترة (%s إلى %s). يرجى التوثيق.', 
                           COALESCE(v_approver_name, 'مسؤول'), 
                           COALESCE(v_requester_name, 'موظف'), 
                           v_start_date, 
                           v_end_date),
                    FALSE,
                    jsonb_build_object('request_id', p_request_id, 'leave_type', v_leave_type, 'for_documentation', TRUE, 'governorate', v_gov),
                    NOW()
                );
            END IF;
        END LOOP;

        -- مشرفو البصمة في نفس المحافظة
        FOR v_bio IN 
            SELECT id FROM public.profiles 
            WHERE governorate = v_gov 
              AND admin_role IN ('biometric', 'attendance_supervisor')
        LOOP
            IF v_leave_type = 'duty' THEN
                INSERT INTO public.system_notifications (
                    recipient_id, sender_id, type, title, content, is_read, metadata, created_at
                ) VALUES (
                    v_bio.id,
                    p_approver_id,
                    'biometric_alert',
                    'إشعار واجب رسمي معتمد (مسؤول البصمة)',
                    format('تم اعتماد خروج واجب رسمي للموظف (%s) إلى (%s) بتاريخ (%s). صاحب الواجب معفي من بصمة نهاية الدوام لعلم مسؤول البصمة.', 
                           COALESCE(v_requester_name, 'موظف'), 
                           COALESCE(v_destination, 'جهة رسمية'), 
                           v_start_date),
                    FALSE,
                    jsonb_build_object('request_id', p_request_id, 'leave_type', 'duty', 'for_attendance', TRUE, 'governorate', v_gov),
                    NOW()
                );
            ELSE
                INSERT INTO public.system_notifications (
                    recipient_id, sender_id, type, title, content, is_read, metadata, created_at
                ) VALUES (
                    v_bio.id,
                    p_approver_id,
                    'biometric_alert',
                    'إشعار إجازة معتمدة (مسؤول البصمة)',
                    format('تم اعتماد إجازة للموظف (%s) للفترة (%s إلى %s) لعلم مسؤول البصمة.', 
                           COALESCE(v_requester_name, 'موظف'), 
                           v_start_date, 
                           v_end_date),
                    FALSE,
                    jsonb_build_object('request_id', p_request_id, 'leave_type', v_leave_type, 'for_attendance', TRUE, 'governorate', v_gov),
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;

    -- =========================================================================
    -- د) توثيق الحدث في سجل حركات الإشعارات
    -- =========================================================================
    INSERT INTO public.notification_audit_log (
        request_id,
        actor_id,
        action,
        action_details,
        created_at
    ) VALUES (
        p_request_id,
        p_approver_id,
        'settle_' || p_action,
        jsonb_build_object(
            'leave_type', v_leave_type,
            'requester_id', v_requester_id,
            'requester_name', v_requester_name,
            'approver_name', v_approver_name,
            'notes', p_notes
        ),
        NOW()
    );

    RETURN jsonb_build_object('success', TRUE);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.core_settle_request_approval(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_settle_request_approval(UUID, UUID, TEXT, TEXT) TO authenticated;


-- 3) سياسة شريط الأخبار: السماح بالقراءة للجميع (public) لضمان ظهور الشريط الإخباري دائماً
DROP POLICY IF EXISTS admin_tips_select_my_gov ON public.admin_tips;
DROP POLICY IF EXISTS admin_tips_select_all ON public.admin_tips;
CREATE POLICY admin_tips_select_all ON public.admin_tips
    FOR SELECT TO public
    USING (true);

-- إشعار PostgREST بإعادة تحميل Schema Cache فوراً
NOTIFY pgrst, 'reload schema';
