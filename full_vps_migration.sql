-- =====================================================================
-- FULL PRECISION DATABASE MIGRATION SCRIPT (CLOUD -> LOCAL VPS)
-- Generated: 2026-08-27T18:52:50.768Z
-- =====================================================================

BEGIN;

-- 1. FTTH SIMULATOR TABLES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiber_sim_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'مشروع بلا اسم'::text,
    phase TEXT NOT NULL DEFAULT 'civil'::text,
    entities JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fiber_sim_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL,
    total_cost_usd NUMERIC NOT NULL DEFAULT 0,
    coverage_homes INTEGER NOT NULL DEFAULT 0,
    optical_pass BOOLEAN NOT NULL DEFAULT false,
    stars SMALLINT NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for FTTH
CREATE INDEX IF NOT EXISTS idx_fiber_sim_projects_user ON public.fiber_sim_projects USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiber_sim_scores_user ON public.fiber_sim_scores USING btree (user_id, created_at DESC);

-- Enable RLS for FTTH
ALTER TABLE public.fiber_sim_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiber_sim_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid collision
DROP POLICY IF EXISTS "fiber_sim_projects_owner" ON public.fiber_sim_projects;
DROP POLICY IF EXISTS "fiber_sim_projects_all" ON public.fiber_sim_projects;
CREATE POLICY "fiber_sim_projects_owner" ON public.fiber_sim_projects
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fiber_sim_scores_owner" ON public.fiber_sim_scores;
DROP POLICY IF EXISTS "fiber_sim_scores_all" ON public.fiber_sim_scores;
CREATE POLICY "fiber_sim_scores_owner" ON public.fiber_sim_scores
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Grant permissions to anon and authenticated
GRANT ALL ON TABLE public.fiber_sim_projects TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fiber_sim_scores TO anon, authenticated, service_role;

-- 2. MISSING COLUMNS IN EXISTING TABLES
-- ---------------------------------------------------------------------
-- attendance_settings
ALTER TABLE public.attendance_settings 
    ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]'::jsonb;

-- field_permissions
ALTER TABLE public.field_permissions 
    ADD COLUMN IF NOT EXISTS permission_levels INTEGER[] NOT NULL DEFAULT '{4}'::integer[];

-- financial_records
ALTER TABLE public.financial_records 
    ADD COLUMN IF NOT EXISTS sick_leaves_balance INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS unpaid_leaves_total INTEGER DEFAULT 0;

-- leave_requests
ALTER TABLE public.leave_requests 
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS time_off_subtype TEXT,
    ADD COLUMN IF NOT EXISTS with_request BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_leave_requests_subtype ON public.leave_requests USING btree (time_off_subtype) WHERE (time_off_subtype IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_leave_requests_with_request ON public.leave_requests USING btree (with_request) WHERE (with_request = false);

-- work_schedule_days
ALTER TABLE public.work_schedule_days 
    ADD COLUMN IF NOT EXISTS is_morning BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_evening BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_night BOOLEAN DEFAULT false;

-- 3. STORED FUNCTIONS & RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_leave_request(p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_supervisor_id UUID;
    v_status TEXT;
BEGIN
    -- 1. التأكد من وجود الطلب وجلب معرف المشرف المسجل فيه
    SELECT supervisor_id, status 
    INTO v_supervisor_id, v_status
    FROM public.leave_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'الطلب غير موجود أو تم حذفه مسبقاً.');
    END IF;

    -- 2. تدقيق أمني (Cybersecurity Check):
    -- منع أي مستخدم آخر من حذف الطلب باستثناء المشرف المعلق عنده هذا الإشعار
    IF auth.uid() != v_supervisor_id THEN
        RETURN json_build_object('success', false, 'message', 'إجراء مرفوض: ليس لديك صلاحية حذف هذا الطلب.');
    END IF;

    -- 3. تنفيذ الحذف النهائي للطلب لتنظيف صندوق الإشعارات
    DELETE FROM public.leave_requests WHERE id = p_request_id;

    RETURN json_build_object('success', true, 'message', 'تم حذف الطلب المعلق بنجاح.');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'حدث خطأ غير متوقع: ' || SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.convert_cumulative_time()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user RECORD;
    v_days INTEGER;
    v_minutes_remaining INTEGER;
    v_new_request_id UUID;
    v_hr_id UUID;
BEGIN
    FOR v_user IN
        SELECT user_id, cumulative_minutes FROM public.financial_records WHERE cumulative_minutes >= 420
    LOOP
        v_days := FLOOR(v_user.cumulative_minutes / 420);
        v_minutes_remaining := v_user.cumulative_minutes % 420;
        
        INSERT INTO public.leave_requests (
            user_id, leave_type, start_date, end_date, days_count, status, leave_status, reason, converted_to_cumulative
        ) VALUES (
            v_user.user_id, 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, 'approved', 'approved', 'تحويل تلقائي للزمنيات المتراكمة', TRUE
        ) RETURNING id INTO v_new_request_id;
        
        INSERT INTO public.leaves_details (
            user_id, year, leave_type, start_date, end_date, duration, created_at
        ) VALUES (
            v_user.user_id, EXTRACT(YEAR FROM CURRENT_DATE), 'cumulative_time', CURRENT_DATE, CURRENT_DATE, v_days, NOW()
        );
        
        UPDATE public.financial_records
        SET cumulative_minutes = v_minutes_remaining, remaining_leaves_balance = remaining_leaves_balance - v_days
        WHERE user_id = v_user.user_id;

        -- أرسل إشعار لـ HR
        FOR v_hr_id IN (
            SELECT id FROM public.profiles WHERE role = 'admin' OR admin_role = 'hr_supervisor'
        ) LOOP
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_hr_id, v_user.user_id, 'system_alert', 'تحويل زمنيات تراكمية', 'تم تحويل ' || v_days || ' يوم للموظف.',
                jsonb_build_object('leave_type', 'cumulative_time', 'days', v_days), NOW()
            );
        END LOOP;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_modify_check(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_request RECORD;
BEGIN
    v_user_id := auth.uid();
    
    SELECT id, user_id, leave_type, status, leave_status 
    INTO v_request 
    FROM public.leave_requests 
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object(
        'auth_uid', v_user_id,
        'request_user_id', v_request.user_id,
        'request_found', v_request.id IS NOT NULL,
        'ids_match', v_request.user_id = v_user_id,
        'leave_type', v_request.leave_type,
        'status', v_request.status,
        'leave_status', v_request.leave_status
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_active_training_poll()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  -- المحاولة الأولى: رابط التدريب الصيفي
  SELECT json_build_object(
    'id', id,
    'content', content,
    'title', title,
    'is_active', is_active
  ) INTO result
  FROM public.media_content
  WHERE type = 'poll_link_training'
  ORDER BY updated_at DESC
  LIMIT 1;

  -- المحاولة الثانية: الرابط العام إذا لم يكن رابط التدريب متوفراً أو محتواه فارغ
  IF result IS NULL OR (result->>'content') IS NULL OR (result->>'content') = '' THEN
    SELECT json_build_object(
      'id', id,
      'content', content,
      'title', title,
      'is_active', is_active
    ) INTO result
    FROM public.media_content
    WHERE type = 'poll_link'
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_profiles()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, dept_text text, job_number text, username text, role text, admin_role text, department_id uuid, section_text text, unit_text text, governorate text, has_capacities_access boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT 
    p.id, 
    p.full_name::text, 
    p.avatar_url::text, 
    p.dept_text::text, 
    p.job_number::text, 
    p.username::text, 
    p.role::text, 
    p.admin_role::text, 
    p.department_id, 
    p.section_text::text, 
    p.unit_text::text,
    p.governorate::text,
    p.has_capacities_access::boolean
  FROM public.profiles p;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_basic_profiles(p_user_ids uuid[])
 RETURNS TABLE(id uuid, full_name text, job_number text, avatar_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, full_name, job_number, avatar_url
  FROM public.profiles
  WHERE id = ANY(p_user_ids);
$function$
;

CREATE OR REPLACE FUNCTION public.modify_leave_request(p_request_id uuid, p_modification_type text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_days_count integer DEFAULT NULL::integer, p_cut_date date DEFAULT NULL::date, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_request RECORD;
    v_first_supervisor UUID;
BEGIN
    -- [الحارس]: التحقق من المصادقة 
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول أولاً';
    END IF;

    -- جلب الطلب والتأكد من وجوده
    SELECT * INTO v_request FROM public.leave_requests WHERE id = p_request_id;
    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطلب غير موجود.');
    END IF;

    -- [حماية الملكية]: التأكد أن الموظف يعدل طلبه هو فقط
    IF v_request.user_id::text != v_user_id::text THEN
         RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بتعديل هذا الطلب.');
    END IF;

    -- معالجة الإلغاء
    IF p_modification_type = 'canceled' THEN
        UPDATE public.leave_requests
        SET cancellation_status = 'pending', modification_type = 'canceled', cancellation_reason = p_cancellation_reason
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب إلغاء الإجازة بنجاح.');

    -- معالجة قطع الإجازة
    ELSIF p_modification_type = 'cut' THEN
        UPDATE public.leave_requests
        SET cut_status = 'pending', cut_date = p_cut_date, modification_type = 'cut'
        WHERE id = p_request_id;
        RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب قطع الإجازة بنجاح.');

    -- تعديل بيانات الطلب
    ELSIF p_modification_type = 'edited' THEN
        IF v_request.approval_chain IS NOT NULL AND array_length(v_request.approval_chain, 1) > 0 THEN
            v_first_supervisor := (v_request.approval_chain)[1];
        ELSE
            v_first_supervisor := v_request.supervisor_id;
        END IF;

        UPDATE public.leave_requests
        SET start_date = COALESCE(p_start_date, start_date),
            end_date = COALESCE(p_end_date, end_date),
            days_count = COALESCE(p_days_count, days_count),
            modification_type = 'edited',
            status = 'pending',
            leave_status = 'pending',
            current_approval_step = 1,
            supervisor_id = v_first_supervisor,
            is_read_by_employee = false
        WHERE id = p_request_id;
        
        IF v_first_supervisor IS NOT NULL THEN
            INSERT INTO public.system_notifications (
                recipient_id, sender_id, type, title, content, metadata, created_at
            ) VALUES (
                v_first_supervisor, v_user_id, 'leave_request', 'طلب إجازة معدل', 
                'تم تعديل طلب إجازة وهو بانتظار موافقتك من جديد.',
                jsonb_build_object('request_id', p_request_id, 'leave_type', v_request.leave_type), NOW()
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'تم التعديل وإرسال الطلب للموافقة من جديد.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'نوع التعديل غير صالح.');
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_new_device(p_employee_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_admin_id UUID;
BEGIN
    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE role = 'admin' AND admin_role IN ('developer', 'general', 'biometric')
    LOOP
        INSERT INTO public.system_notifications (recipient_id, title, content)
        VALUES (
            v_admin_id,
            'تسجيل جهاز جديد',
            'قام الموظف (' || COALESCE(p_employee_name, 'موظف') || ') بتسجيل جهازه لأول مرة بنجاح.'
        );
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_device_mismatch(p_employee_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_employee_name TEXT;
    v_admin_id UUID;
    v_count INTEGER := 0;
BEGIN
    SELECT full_name INTO v_employee_name 
    FROM public.profiles 
    WHERE id = p_employee_id;

    FOR v_admin_id IN 
        SELECT id FROM public.profiles 
        WHERE (admin_role IN ('developer', 'general') OR role = 'admin')
          AND id != p_employee_id
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
            v_admin_id,
            p_employee_id,
            'device_mismatch',
            'تنبيه: تسجيل من جهاز غير معتمد',
            'قام الموظف (' || COALESCE(v_employee_name, 'موظف') || ') بتسجيل البصمة من جهاز غير معتمد، يرجى المراجعة.',
            false,
            jsonb_build_object('employee_id', p_employee_id, 'action', 'device_requests'),
            NOW()
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_device_change_request(p_employee_id uuid, p_old_device_id text, p_new_device_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.device_change_requests 
        WHERE employee_id = p_employee_id 
          AND new_device_id = p_new_device_id 
          AND status = 'pending'
    ) THEN
        INSERT INTO public.device_change_requests (employee_id, old_device_id, new_device_id, status)
        VALUES (p_employee_id, p_old_device_id, p_new_device_id, 'pending');
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_time_leave_auto_converted(p_leave_date date, p_reason text, p_supervisor_id uuid, p_approval_chain uuid[], p_total_minutes integer, p_existing_minutes integer DEFAULT 0, p_time_off_subtype text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_request_id uuid;
    v_user_name TEXT;
    v_cumulative INTEGER;
    v_subtype_label TEXT;
    v_details TEXT;
    v_why TEXT;
    v_hr RECORD;
BEGIN
    v_cumulative := COALESCE(p_existing_minutes, 0) + COALESCE(p_total_minutes, 0);

    /* صيانة المدخلات */
    IF p_leave_date IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'تاريخ الإجازة مطلوب');
    END IF;
    IF p_total_minutes IS NULL OR p_total_minutes <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'مدة الإجازة غير صالحة');
    END IF;

    v_subtype_label := CASE p_time_off_subtype
        WHEN 'mid_shift' THEN 'وسط الدوام'
        WHEN 'shift_start' THEN 'بداية الدوام'
        WHEN 'shift_end' THEN 'نهاية الدوام'
        ELSE 'زمنية'
    END;

    /* 1) إدراج الإجازة الاعتيادية معتمدة مباشرة (يوم واحد لنفس التاريخ) */
    INSERT INTO public.leave_requests (
        user_id, leave_type, start_date, end_date, days_count, reason,
        supervisor_id, approval_chain, time_duration_minutes, destination,
        with_pay, supporting_image_urls, status, leave_status,
        time_off_subtype, with_request, created_at, is_read_by_employee
    ) VALUES (
        auth.uid(), 'regular', p_leave_date, p_leave_date, 1, p_reason,
        p_supervisor_id, p_approval_chain, NULL, NULL,
        true, '{}', 'approved', 'approved',
        NULL, true, NOW(), false
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

    /* 2) إشعار المسؤول المباشر */
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

    /* 3) إشعار الموارد البشرية (HR) */
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

    /* 4) إشعار الموظف المعني */
    INSERT INTO public.system_notifications (
        recipient_id, sender_id, type, title, content, metadata, created_at
    ) VALUES (
        auth.uid(), auth.uid(), 'leave_auto_converted',
        'تم تحويل طلبك إلى إجازة اعتيادية معتمدة',
        'طلبك الزمني حُوِّل تلقائياً إلى إجازة اعتيادية معتمدة ليوم واحد. ' || v_details || '. ' || v_why,
        jsonb_build_object(
            'request_id', v_request_id,
            'leave_type', 'regular',
            'converted_from', 'time_off',
            'leave_date', p_leave_date,
            'total_minutes', v_cumulative
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم تحويل الطلب إلى إجازة اعتيادية معتمدة وإشعار الجهات المعنية.',
        'request_id', v_request_id,
        'converted', true
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_typed_leave_request(p_leave_type text, p_start_date date, p_end_date date, p_days_count integer, p_reason text, p_supervisor_id uuid, p_approval_chain uuid[], p_time_duration_minutes integer DEFAULT NULL::integer, p_destination text DEFAULT NULL::text, p_with_pay boolean DEFAULT true, p_supporting_image_urls text[] DEFAULT '{}'::text[], p_time_off_subtype text DEFAULT NULL::text, p_with_request boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_request_id uuid;
    v_subtype_label TEXT; v_notif_title TEXT; v_notif_content TEXT; v_user_name TEXT;
BEGIN
    IF p_leave_type NOT IN ('regular', 'long_regular', 'sick', 'long_sick', 'time_off', 'dispatch', 'duty', 'cumulative_time') THEN RETURN jsonb_build_object('success', false, 'message', 'نوع إجازة غير صالح'); END IF;
    INSERT INTO public.leave_requests (user_id, leave_type, start_date, end_date, days_count, reason, supervisor_id, approval_chain, time_duration_minutes, destination, with_pay, supporting_image_urls, status, leave_status, time_off_subtype, with_request, created_at) VALUES (auth.uid(), p_leave_type, p_start_date, p_end_date, p_days_count, p_reason, p_supervisor_id, p_approval_chain, p_time_duration_minutes, p_destination, p_with_pay, p_supporting_image_urls, 'pending', 'pending', p_time_off_subtype, p_with_request, NOW()) RETURNING id INTO v_new_request_id;
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = auth.uid();
    IF p_leave_type = 'time_off' THEN
        v_subtype_label := CASE p_time_off_subtype WHEN 'mid_shift' THEN 'وسط الدوام' WHEN 'shift_start' THEN 'بداية الدوام' WHEN 'shift_end' THEN 'نهاية الدوام' ELSE 'زمنية' END;
        v_notif_title := 'طلب إجازة زمنية — ' || v_subtype_label; v_notif_content := COALESCE(v_user_name, 'موظف') || ' يطلب إجازة زمنية (' || v_subtype_label || ') بمدة ' || COALESCE(p_time_duration_minutes, 0) || ' دقيقة.';
    ELSE
        v_notif_title := 'طلب إجازة جديد'; v_notif_content := 'طلب جديد بانتظار موافقتك. (' || COALESCE(p_reason, '') || ')';
    END IF;
    IF p_supervisor_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (recipient_id, sender_id, type, title, content, metadata, created_at) VALUES (p_supervisor_id, auth.uid(), 'leave_request', v_notif_title, v_notif_content, jsonb_build_object('request_id', v_new_request_id, 'leave_type', p_leave_type, 'time_off_subtype', p_time_off_subtype, 'with_request', p_with_request), NOW());
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'تم تقديم طلب الإجازة بنجاح.', 'request_id', v_new_request_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

-- 4. MIGRATE FTTH PROJECTS DATA FROM CLOUD
-- ---------------------------------------------------------------------

INSERT INTO public.fiber_sim_projects (id, user_id, map_id, name, phase, entities, created_at, updated_at)
VALUES ('f68b8d4b-4370-406f-a2d7-5f58d12fdfeb', 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d', 'alley-16', 'مسلم1', 'optical', '{"fats":[{"x":97,"y":62,"id":"d82b692d-08d8-4315-bb24-8654b5ca5aea","ports":16,"splitter":"1:16"}],"drops":[{"id":"42e59bef-7abb-4883-b4ba-beee1689fde5","points":[{"x":97,"y":62},{"x":105,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h5"},{"id":"d55cd358-8c6b-40c6-b2c9-3c94c30363eb","points":[{"x":97,"y":62},{"x":120,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h6"},{"id":"e69f1759-f1ec-418c-80b6-c52b350eae0e","points":[{"x":97,"y":62},{"x":135,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h7"},{"id":"65fad0bb-cc09-4aee-86fb-2053f51a524e","points":[{"x":97,"y":62},{"x":150,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h8"},{"id":"03c49971-d394-4ce8-9d3f-1ff97b1d6881","points":[{"x":97,"y":62},{"x":90,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h4"},{"id":"233b132c-b834-418e-aa85-9c17f19cb34a","points":[{"x":97,"y":62},{"x":75,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h3"},{"id":"43487449-4899-4301-a9cf-6cce8032034c","points":[{"x":97,"y":62},{"x":60,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h2"},{"id":"2d2a907c-1408-4b98-b0ff-b96524ad1b56","points":[{"x":97,"y":62},{"x":45,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h1"}],"cabinets":[{"x":15.5,"y":73,"id":"0f3adc82-943b-4bf8-a881-f0d5e682a6e7","capacityF":96}],"trenches":[{"id":"3b256c44-30a9-4fde-a3bf-b63c2fe5d72d","ducts":{"hdpe32":1,"hdpe40":0,"micro7":0},"method":"open_asphalt","points":[{"x":13.5,"y":26},{"x":13.500000000000004,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661}]}],"structures":[{"x":99.64244851258582,"y":75,"id":"348ca3df-24a7-4498-8e3e-394f31ff5a6c","kind":"manhole"},{"x":14,"y":77,"id":"826c7725-2981-4ad5-aa21-ba763d6fa508","kind":"manhole"}]}'::jsonb, '2026-08-22T22:10:41.829Z', '2026-08-24T20:27:49.875Z')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phase = EXCLUDED.phase,
    entities = EXCLUDED.entities,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.fiber_sim_projects (id, user_id, map_id, name, phase, entities, created_at, updated_at)
VALUES ('1173550c-3145-48d3-93c2-59ade7d69b54', 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d', 'alley-16', 'مسلم', 'optical', '{"fats":[{"x":97,"y":62,"id":"d82b692d-08d8-4315-bb24-8654b5ca5aea","ports":16,"splitter":"1:16"}],"drops":[{"id":"42e59bef-7abb-4883-b4ba-beee1689fde5","points":[{"x":97,"y":62},{"x":105,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h5"},{"id":"d55cd358-8c6b-40c6-b2c9-3c94c30363eb","points":[{"x":97,"y":62},{"x":120,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h6"},{"id":"e69f1759-f1ec-418c-80b6-c52b350eae0e","points":[{"x":97,"y":62},{"x":135,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h7"},{"id":"65fad0bb-cc09-4aee-86fb-2053f51a524e","points":[{"x":97,"y":62},{"x":150,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h8"},{"id":"03c49971-d394-4ce8-9d3f-1ff97b1d6881","points":[{"x":97,"y":62},{"x":90,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h4"},{"id":"233b132c-b834-418e-aa85-9c17f19cb34a","points":[{"x":97,"y":62},{"x":75,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h3"},{"id":"43487449-4899-4301-a9cf-6cce8032034c","points":[{"x":97,"y":62},{"x":60,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h2"},{"id":"2d2a907c-1408-4b98-b0ff-b96524ad1b56","points":[{"x":97,"y":62},{"x":45,"y":62}],"fromFatId":"d82b692d-08d8-4315-bb24-8654b5ca5aea","toBuildingId":"h1"}],"cabinets":[{"x":15.5,"y":73,"id":"0f3adc82-943b-4bf8-a881-f0d5e682a6e7","capacityF":96}],"trenches":[{"id":"3b256c44-30a9-4fde-a3bf-b63c2fe5d72d","ducts":{"hdpe32":1,"hdpe40":0,"micro7":0},"method":"open_asphalt","points":[{"x":13.5,"y":26},{"x":13.500000000000004,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661},{"x":171.8936517929472,"y":75.20316540620661}]}],"structures":[{"x":99.64244851258582,"y":75,"id":"348ca3df-24a7-4498-8e3e-394f31ff5a6c","kind":"manhole"},{"x":14,"y":77,"id":"826c7725-2981-4ad5-aa21-ba763d6fa508","kind":"manhole"}]}'::jsonb, '2026-08-24T22:20:35.664Z', '2026-08-24T22:20:35.664Z')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phase = EXCLUDED.phase,
    entities = EXCLUDED.entities,
    updated_at = EXCLUDED.updated_at;

COMMIT;
