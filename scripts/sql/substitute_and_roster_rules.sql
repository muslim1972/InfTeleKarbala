-- ============================================================
-- منظومة الموظف البديل (Substitute System) وقواعد شفتات الخفر
-- ============================================================

-- 1. إضافة أعمدة الموظف البديل في جدول leave_requests إن لم تكن موجودة
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'substitute_id') THEN
        ALTER TABLE public.leave_requests ADD COLUMN substitute_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'substitute_status') THEN
        ALTER TABLE public.leave_requests ADD COLUMN substitute_status text DEFAULT 'none' CHECK (substitute_status IN ('none', 'pending', 'approved', 'rejected'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'substitute_rejection_reason') THEN
        ALTER TABLE public.leave_requests ADD COLUMN substitute_rejection_reason text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests' AND column_name = 'substitute_action_at') THEN
        ALTER TABLE public.leave_requests ADD COLUMN substitute_action_at timestamptz;
    END IF;
END $$;

-- فهرس لتسريع استعلامات الطلبات المكلف بها الموظف كبديل
CREATE INDEX IF NOT EXISTS idx_leave_requests_substitute ON public.leave_requests(substitute_id, substitute_status);

-- إسقاط أي نسخ سابقة مختلفة الوسائط منعاً لتضارب الـ overload
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS proc_name
        FROM pg_proc
        WHERE proname IN ('submit_typed_leave_request', 'submit_time_leave_auto_converted')
          AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc_name;
    END LOOP;
END $$;

-- 2. تحديث دالة submit_typed_leave_request لدعم الموظف البديل
-- عند تحديد بديل: يذهب الإشعار للبديل أولاً ويبقى الطلب بانتظار موافقته، ولا يذهب للمسؤول إلا بعد موافقة البديل
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
    p_leave_start_time TIME DEFAULT NULL,
    p_leave_end_time TIME DEFAULT NULL,
    p_substitute_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_request_id uuid;
    v_subtype_label TEXT;
    v_notif_title TEXT;
    v_notif_content TEXT;
    v_user_name TEXT;
    v_sub_status TEXT := 'none';
BEGIN
    /* التحقق من نوع الإجازة */
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع إجازة غير صالح');
    END IF;

    /* التحقق من نوع الزمنية الفرعي */
    IF p_time_off_subtype IS NOT NULL AND p_time_off_subtype NOT IN ('mid_shift', 'shift_start', 'shift_end') THEN
        RETURN jsonb_build_object('success', false, 'message', 'نوع زمنية فرعي غير صالح');
    END IF;

    IF p_substitute_id IS NOT NULL THEN
        IF p_substitute_id = auth.uid() THEN
            RETURN jsonb_build_object('success', false, 'message', 'لا يمكنك اختيار نفسك كموظف بديل');
        END IF;
        v_sub_status := 'pending';
    END IF;

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

    /* جلب اسم الموظف صاحب الطلب */
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

    /* تحديد تسمية نوع الإجازة */
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
            ELSE p_leave_type
        END;
    END IF;

    -- مسار الإشعارات الذكي:
    -- إذا حُدد موظف بديل: يذهب الإشعار للبديل أولاً لاستحصال موافقته، ويبقى الطلب معلقاً للمسؤول
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
        -- لا يوجد بديل: إشعار فوري للمسؤول المباشر كالمعتاد
        IF p_leave_type = 'time_off' THEN
            v_notif_title := 'طلب إجازة زمنية — ' || v_subtype_label;
            v_notif_content := COALESCE(v_user_name, 'موظف') || ' يطلب إجازة زمنية (' || v_subtype_label || ') بمدة ' || COALESCE(p_time_duration_minutes, 0) || ' دقيقة.';
        ELSE
            v_notif_title := 'طلب إجازة جديد';
            v_notif_content := 'طلب جديد بانتظار موافقتك. (' || COALESCE(p_reason, '') || ')';
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
                    'time_off_subtype', p_time_off_subtype,
                    'with_request', p_with_request
                ),
                NOW()
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE WHEN p_substitute_id IS NOT NULL THEN 'تم إرسال طلب التكليف للموظف البديل بانتظار موافقته.' ELSE 'تم تقديم طلب الإجازة بنجاح.' END,
        'request_id', v_new_request_id,
        'waiting_for_substitute', (p_substitute_id IS NOT NULL)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3. دالة استجابة الموظف البديل (موافقة أو رفض)
CREATE OR REPLACE FUNCTION public.respond_to_substitute_request(
    p_request_id UUID,
    p_action TEXT, -- 'approve' | 'reject'
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req RECORD;
    v_sub_name TEXT;
    v_notif_title TEXT;
    v_notif_content TEXT;
    v_subtype_label TEXT;
BEGIN
    SELECT * INTO v_req FROM public.leave_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
    END IF;

    IF v_req.substitute_id IS NULL OR v_req.substitute_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بالرد على هذا الطلب كبديل');
    END IF;

    IF v_req.substitute_status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'تم الرد على هذا الطلب مسبقاً');
    END IF;

    SELECT full_name INTO v_sub_name FROM public.profiles WHERE id = auth.uid();

    IF p_action = 'approve' THEN
        -- 1. تحديث حالة البديل إلى موافقة
        UPDATE public.leave_requests
        SET substitute_status = 'approved',
            substitute_action_at = NOW()
        WHERE id = p_request_id;

        -- 2. إشعار لصاحب الطلب بأن البديل وافق وتم توجيه الطلب للمسؤول
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            v_req.user_id, auth.uid(), 'substitute_response',
            '✅ موافقة الموظف البديل',
            'وافق الزميل (' || COALESCE(v_sub_name, 'البديل') || ') على التكليف كبديل عنك لتاريخ ' || v_req.start_date::text || '. تم الآن إرسال طلبك تلقائياً إلى مسؤولك المباشر للاعتماد.',
            jsonb_build_object('request_id', p_request_id, 'status', 'approved'),
            NOW()
        );

        -- 3. إعطاء الضوء الأخضر للمسؤول المباشر وإرسال إشعار الاعتماد له الآن
        IF v_req.supervisor_id IS NOT NULL THEN
            IF v_req.leave_type = 'time_off' THEN
                v_subtype_label := CASE v_req.time_off_subtype
                    WHEN 'mid_shift' THEN 'وسط الدوام'
                    WHEN 'shift_start' THEN 'بداية الدوام'
                    WHEN 'shift_end' THEN 'نهاية الدوام'
                    ELSE 'زمنية'
                END;
                v_notif_title := 'طلب إجازة زمنية معتمد من البديل — ' || v_subtype_label;
                v_notif_content := 'طلب إجازة زمنية بانتظار موافقتك بعد موافقة الموظف البديل (' || COALESCE(v_sub_name, 'البديل') || ').';
            ELSE
                v_notif_title := 'طلب إجازة جديد (معتمد من البديل)';
                v_notif_content := 'طلب إجازة جديد بانتظار موافقتك بعد موافقة البديل (' || COALESCE(v_sub_name, 'البديل') || '). (' || COALESCE(v_req.reason, '') || ')';
            END IF;

            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_req.supervisor_id, v_req.user_id, 'leave_request',
                v_notif_title, v_notif_content,
                jsonb_build_object(
                    'request_id', p_request_id,
                    'leave_type', v_req.leave_type,
                    'time_off_subtype', v_req.time_off_subtype,
                    'with_request', v_req.with_request,
                    'substitute_id', auth.uid(),
                    'substitute_name', v_sub_name
                ),
                NOW()
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'تمت الموافقة على التكليف كبديل وتوجيه الطلب للمسؤول بنجاح.');

    ELSIF p_action = 'reject' THEN
        -- تحديث حالة البديل إلى رفض وإنهاء الطلب كمرفوض
        UPDATE public.leave_requests
        SET substitute_status = 'rejected',
            substitute_rejection_reason = p_rejection_reason,
            substitute_action_at = NOW(),
            status = 'rejected',
            leave_status = 'rejected',
            is_read_by_employee = false
        WHERE id = p_request_id;

        -- إشعار صاحب الطلب باعتذار البديل لاختيار بديل آخر
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            v_req.user_id, auth.uid(), 'substitute_response',
            '❌ اعتذار الموظف البديل',
            'اعتذر الزميل (' || COALESCE(v_sub_name, 'البديل') || ') عن التكليف كبديل' || CASE WHEN p_rejection_reason IS NOT NULL AND p_rejection_reason <> '' THEN ' لسبب: ' || p_rejection_reason ELSE '' END || '. يرجى اختيار بديل آخر أو مراجعة الطلب.',
            jsonb_build_object('request_id', p_request_id, 'status', 'rejected', 'reason', p_rejection_reason),
            NOW()
        );

        RETURN jsonb_build_object('success', true, 'message', 'تم تسجيل اعتذارك وإشعار صاحب الطلب بنجاح.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. تحديث submit_time_leave_auto_converted لدعم الموظف البديل أيضاً
CREATE OR REPLACE FUNCTION public.submit_time_leave_auto_converted(
    p_leave_date DATE,
    p_reason TEXT,
    p_supervisor_id UUID,
    p_approval_chain UUID[],
    p_total_minutes INTEGER,
    p_existing_minutes INTEGER DEFAULT 0,
    p_time_off_subtype TEXT DEFAULT NULL,
    p_substitute_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id uuid;
    v_user_name TEXT;
    v_cumulative INTEGER;
    v_subtype_label TEXT;
    v_details TEXT;
    v_why TEXT;
    v_hr RECORD;
    v_sub_status TEXT := 'none';
BEGIN
    v_cumulative := COALESCE(p_existing_minutes, 0) + COALESCE(p_total_minutes, 0);

    IF p_leave_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'تاريخ الإجازة مطلوب');
    END IF;
    IF p_total_minutes IS NULL OR p_total_minutes <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'مدة الإجازة غير صالحة');
    END IF;

    IF p_substitute_id IS NOT NULL THEN
        IF p_substitute_id = auth.uid() THEN
            RETURN jsonb_build_object('success', false, 'message', 'لا يمكنك اختيار نفسك كموظف بديل');
        END IF;
        v_sub_status := 'pending';
    END IF;

    v_subtype_label := CASE p_time_off_subtype
        WHEN 'mid_shift' THEN 'وسط الدوام'
        WHEN 'shift_start' THEN 'بداية الدوام'
        WHEN 'shift_end' THEN 'نهاية الدوام'
        ELSE 'زمنية'
    END;

    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at, is_read_by_employee,
        substitute_id, substitute_status
    ) VALUES (
        auth.uid(), 'regular', p_leave_date, p_leave_date, 1, p_reason,
        p_supervisor_id, p_approval_chain, NULL, NULL,
        true, '{}', 'approved', 'approved',
        NULL, true, NOW(), false,
        p_substitute_id, v_sub_status
    ) RETURNING id INTO v_request_id;

    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();

    v_details := 'التاريخ: ' || to_char(p_leave_date, 'YYYY-MM-DD')
        || ' | النوع الزمني: ' || v_subtype_label
        || ' | مدة الطلب: ' || p_total_minutes || ' دقيقة'
        || CASE WHEN COALESCE(p_existing_minutes, 0) > 0
                THEN ' | مدد زمنية سابقة بنفس اليوم: ' || p_existing_minutes || ' دقيقة'
                ELSE '' END
        || ' | المجموع: ' || v_cumulative || ' دقيقة';

    v_why := 'السبب: تجاوز مجموع مدد الإجازات الزمنية لهذا اليوم حدي ساعتين (120 دقيقة)، فتم تحويل الطلب إلزامياً إلى إجازة اعتيادية معتمدة ليوم واحد.';

    IF p_substitute_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            p_substitute_id, auth.uid(), 'substitute_request',
            '📋 إشعار تكليف كبديل (إجازة اعتيادية محولة)',
            'تم تكليفك كبديل عن الزميل (' || COALESCE(v_user_name, 'موظف') || ') لتاريخ ' || p_leave_date::text || ' بعد تحويل الإجازة الزمنية لاعتيادية لتجاوز الساعتين.',
            jsonb_build_object('request_id', v_request_id, 'leave_type', 'regular', 'is_substitute_action', true),
            NOW()
        );
    END IF;

    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            p_supervisor_id, auth.uid(), 'leave_auto_converted',
            'تحويل تلقائي إلى إجازة اعتيادية',
            COALESCE(v_user_name, 'موظف') || ' — ' || v_details || '. ' || v_why,
            jsonb_build_object(
                'request_id', v_request_id,
                'leave_type', 'regular',
                'converted_from', 'time_off',
                'leave_date', p_leave_date,
                'total_minutes', v_cumulative
            ),
            NOW()
        );
    END IF;

    FOR v_hr IN SELECT id FROM public.profiles WHERE role = 'admin' OR admin_role = 'hr_supervisor' LOOP
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata, created_at
        ) VALUES (
            v_hr.id, auth.uid(), 'leave_auto_converted',
            'تحويل تلقائي إلى إجازة اعتيادية',
            COALESCE(v_user_name, 'موظف') || ' — ' || v_details || '. ' || v_why,
            jsonb_build_object(
                'request_id', v_request_id,
                'leave_type', 'regular',
                'converted_from', 'time_off',
                'leave_date', p_leave_date,
                'total_minutes', v_cumulative
            ),
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تحويل الإجازة الزمنية تلقائياً إلى إجازة اعتيادية معتمدة ليوم واحد لتجاوز الساعتين.',
        'request_id', v_request_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_typed_leave_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_substitute_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_time_leave_auto_converted TO authenticated;

