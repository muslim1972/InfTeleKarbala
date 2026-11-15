-- ==============================================================================
-- Migration: 20261115000000_hr01_service_continuity_deputy_and_printer.sql
-- Kernel: BE-HR-01 & BE-CORE-01
-- Purpose: Support Deputy Manager in departments, Printer Operator in profiles, 
--          and dedicated Service Continuity Finance Approval Workflow.
-- ==============================================================================

-- 1) إضافة عمود البديل في جدول departments
ALTER TABLE public.departments
ADD COLUMN IF NOT EXISTS deputy_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- تحديث دالة get_departments_bypass_rls لتعكس العمود الجديد
CREATE OR REPLACE FUNCTION public.get_departments_bypass_rls()
RETURNS SETOF departments
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.departments;
$$;

-- 2) إضافة صلاحية موظف الطابعة في جدول profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_printer_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_printer_operator BOOLEAN DEFAULT FALSE;

-- مزامنة الحقلين معاً في حال تم تحديث أحدهما
CREATE OR REPLACE FUNCTION public.sync_printer_operator_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_printer_operator IS DISTINCT FROM OLD.is_printer_operator THEN
        NEW.has_printer_access := NEW.is_printer_operator;
    ELSIF NEW.has_printer_access IS DISTINCT FROM OLD.has_printer_access THEN
        NEW.is_printer_operator := NEW.has_printer_access;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_printer_operator_flags ON public.profiles;
CREATE TRIGGER trg_sync_printer_operator_flags
BEFORE INSERT OR UPDATE OF is_printer_operator, has_printer_access ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_printer_operator_flags();

-- 3) تحديث قيود وأعمدة جدول service_continuity_requests
ALTER TABLE public.service_continuity_requests
DROP CONSTRAINT IF EXISTS chk_service_continuity_status;

ALTER TABLE public.service_continuity_requests
ADD CONSTRAINT chk_service_continuity_status CHECK (
    status = ANY (ARRAY[
        'pending_finance'::text,
        'rejected_by_finance'::text,
        'pending_print'::text,
        'completed'::text,
        'no_manager_available'::text,
        'pending_supervisor'::text,
        'rejected_by_supervisor'::text,
        'pending_hr'::text,
        'rejected_by_hr'::text,
        'issued_and_dispatched'::text
    ])
);

ALTER TABLE public.service_continuity_requests
ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS approved_by_title TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(256),
ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS printed_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;

-- 4) تحديث دالة تقديم طلب تأييد الاستمرارية
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
    v_nominal NUMERIC(12, 2) := 0;
    v_gross NUMERIC(12, 2) := 0;
    v_net NUMERIC(12, 2) := 0;
    v_finance_dept_id UUID;
    v_finance_manager_id UUID;
    v_finance_deputy_id UUID;
    v_req_id UUID;
    v_user_name TEXT;
    v_include_all BOOLEAN := FALSE;
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

    IF v_gov IS NULL THEN
        v_gov := 'karbala';
    END IF;

    v_include_all := (COALESCE(p_include_nominal_salary, FALSE) OR COALESCE(p_include_total_salary, FALSE));

    -- سحب البيانات المالية المعتمدة إن طُلبت
    IF v_include_all THEN
        SELECT 
            COALESCE(nominal_salary, 0),
            COALESCE(gross_salary, nominal_salary, 0),
            COALESCE(net_salary, gross_salary, nominal_salary, 0)
        INTO v_nominal, v_gross, v_net
        FROM public.financial_records
        WHERE user_id = v_user_id
        LIMIT 1;
    END IF;

    -- البحث عن قسم الإدارة والمالية في محافظة الموظف
    SELECT id, manager_id, deputy_manager_id
    INTO v_finance_dept_id, v_finance_manager_id, v_finance_deputy_id
    FROM public.departments
    WHERE governorate = v_gov
      AND (
          name LIKE '%المالي والاداري%' 
          OR name LIKE '%المالي والإداري%' 
          OR name LIKE '%المالية والادارية%'
          OR name LIKE '%المالية والإدارية%'
          OR name LIKE '%المالي%'
      )
    ORDER BY 
      CASE WHEN name LIKE '%المالي والاداري%' THEN 1 
           WHEN name LIKE '%المالي والإداري%' THEN 2 
           ELSE 3 END ASC
    LIMIT 1;

    -- حالة عدم توفر مسؤول للقسم المالي والإداري وعدم توفر البديل في نفس الوقت
    IF v_finance_manager_id IS NULL AND v_finance_deputy_id IS NULL THEN
        -- إرسال إشعار فوري لصاحب الطلب
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata,
            created_at
        ) VALUES (
            v_user_id,
            v_user_id,
            'تنبيه بشأن طلب تأييد الاستمرارية',
            'يرجى مراجعة الادارة بنفسك لتمشية الطلب لعدم توفر مسؤول في الوقت الحالي',
            'warning',
            jsonb_build_object(
                'status', 'no_manager_available',
                'destination_entity', TRIM(p_destination_entity)
            ),
            NOW()
        );

        RETURN jsonb_build_object(
            'success', false,
            'status', 'no_manager_available',
            'message', 'يرجى مراجعة الادارة بنفسك لتمشية الطلب لعدم توفر مسؤول في الوقت الحالي'
        );
    END IF;

    -- إدراج الطلب بحالة pending_finance
    INSERT INTO public.service_continuity_requests (
        user_id,
        destination_entity,
        include_nominal_salary,
        include_total_salary,
        include_salary_details,
        nominal_salary_snapshot,
        total_salary_snapshot,
        gross_salary_snapshot,
        notes,
        status,
        supervisor_id,
        governorate
    ) VALUES (
        v_user_id,
        TRIM(p_destination_entity),
        v_include_all,
        v_include_all,
        v_include_all,
        v_nominal,
        v_net,
        v_gross,
        NULLIF(TRIM(p_notes), ''),
        'pending_finance',
        COALESCE(v_finance_manager_id, v_finance_deputy_id),
        v_gov
    ) RETURNING id INTO v_req_id;

    -- إشعار مسؤول القسم المالي والإداري الأصيل إن وُجد
    IF v_finance_manager_id IS NOT NULL THEN
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata,
            created_at
        ) VALUES (
            v_finance_manager_id,
            v_user_id,
            'طلب تأييد استمرار بالخدمة جديد',
            format('قدم الموظف (%s) طلب تأييد استمرار بالخدمة معنون إلى (%s)', v_user_name, TRIM(p_destination_entity)),
            'service_continuity_finance',
            jsonb_build_object(
                'request_id', v_req_id,
                'requester_name', v_user_name,
                'destination_entity', TRIM(p_destination_entity),
                'has_salary', v_include_all,
                'notes', NULLIF(TRIM(p_notes), ''),
                'governorate', v_gov,
                'is_deputy', false
            ),
            NOW()
        );
    END IF;

    -- إشعار بديل مسؤول القسم المالي والإداري إن وُجد
    IF v_finance_deputy_id IS NOT NULL AND v_finance_deputy_id <> COALESCE(v_finance_manager_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.system_notifications (
            recipient_id,
            sender_id,
            title,
            content,
            type,
            metadata,
            created_at
        ) VALUES (
            v_finance_deputy_id,
            v_user_id,
            'طلب تأييد استمرار بالخدمة جديد (نسخة البديل)',
            format('قدم الموظف (%s) طلب تأييد استمرار بالخدمة معنون إلى (%s)', v_user_name, TRIM(p_destination_entity)),
            'service_continuity_finance',
            jsonb_build_object(
                'request_id', v_req_id,
                'requester_name', v_user_name,
                'destination_entity', TRIM(p_destination_entity),
                'has_salary', v_include_all,
                'notes', NULLIF(TRIM(p_notes), ''),
                'governorate', v_gov,
                'is_deputy', true
            ),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'status', 'pending_finance',
        'message', 'تم إرسال الطلب بنجاح إلى مسؤول القسم المالي والإداري وبديله للاعتماد'
    );
END;
$$;

-- 5) دالة الموافقة من قبل مسؤول الإدارة والمالية أو بديله (ذرية ضد التزامن)
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
        RAISE EXCEPTION 'عذراً، تم البت في هذا الطلب مسبقاً من قبل مسؤول آخر';
    END IF;

    -- جلب معلومات القائم بالاعتماد
    SELECT full_name INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

    -- جلب اسم صاحب الطلب
    SELECT full_name INTO v_requester_name
    FROM public.profiles
    WHERE id = v_req.user_id;

    -- التحقق من صفة القائم بالاعتماد (أصيل أم بديل)
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
        -- في حال كان مشرف عام أو مطور
        v_actor_title := 'القسم المالي والإداري';
    END IF;

    -- تحديث الطلب إلى جاهز للطباعة وتثبيت اسم المعتمد وصفته
    UPDATE public.service_continuity_requests
    SET status = 'pending_print',
        approved_by_id = v_actor_id,
        approved_by_name = v_actor_name,
        approved_by_title = v_actor_title,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- أرشفة إشعارات الأصيل والبديل فوراً (تعليمها كمقروءة)
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
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
            format('يرجى طباعة كتاب تأييد الاستمرارية للموظف (%s) المعنون إلى (%s)', COALESCE(v_requester_name, 'موظف'), v_req.destination_entity),
            'service_continuity_print',
            jsonb_build_object(
                'request_id', p_request_id,
                'requester_name', v_requester_name,
                'destination_entity', v_req.destination_entity,
                'approved_by_name', v_actor_name,
                'approved_by_title', v_actor_title,
                'governorate', v_req.governorate
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

-- 6) دالة الرفض من قبل مسؤول الإدارة والمالية أو بديله
CREATE OR REPLACE FUNCTION public.reject_continuity_by_finance(
    p_request_id UUID,
    p_reason TEXT DEFAULT NULL
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
    v_clean_reason VARCHAR(256);
    v_msg_content TEXT;
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
        RAISE EXCEPTION 'طلب الاستمرارية غير موجود';
    END IF;

    IF v_req.status <> 'pending_finance' THEN
        RAISE EXCEPTION 'عذراً، تم البت في هذا الطلب مسبقاً من قبل مسؤول آخر';
    END IF;

    SELECT full_name INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;

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

    v_clean_reason := SUBSTRING(TRIM(COALESCE(p_reason, '')) FROM 1 FOR 256);
    IF v_clean_reason = '' THEN
        v_clean_reason := NULL;
    END IF;

    -- تحديث الطلب إلى مرفوض
    UPDATE public.service_continuity_requests
    SET status = 'rejected_by_finance',
        approved_by_id = v_actor_id,
        approved_by_name = v_actor_name,
        approved_by_title = v_actor_title,
        rejection_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- أرشفة إشعارات المالية
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND type = 'service_continuity_finance';

    -- صياغة رسالة الرفض للموظف
    IF v_clean_reason IS NOT NULL THEN
        v_msg_content := format('تم رفض طلب تأييد الاستمرارية من قبل %s (%s) - سبب الرفض: %s', v_actor_name, v_actor_title, v_clean_reason);
    ELSE
        v_msg_content := format('تم رفض طلب تأييد الاستمرارية من قبل %s (%s)', v_actor_name, v_actor_title);
    END IF;

    -- إرسال إشعار الرفض للموظف
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
        'تم رفض طلب تأييد الاستمرارية',
        v_msg_content,
        'error',
        jsonb_build_object(
            'request_id', p_request_id,
            'rejected_by_name', v_actor_name,
            'rejected_by_title', v_actor_title,
            'reason', v_clean_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم رفض الطلب بنجاح وأُشعر الموظف بذلك'
    );
END;
$$;

-- 7) دالة التعديل والموافقة المباشرة
CREATE OR REPLACE FUNCTION public.update_and_approve_continuity_by_finance(
    p_request_id UUID,
    p_destination_entity TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_destination_entity IS NULL OR TRIM(p_destination_entity) = '' THEN
        RAISE EXCEPTION 'يرجى تحديد الجهة المعنون إليها الكتاب';
    END IF;

    UPDATE public.service_continuity_requests
    SET destination_entity = TRIM(p_destination_entity),
        notes = NULLIF(TRIM(p_notes), ''),
        updated_at = NOW()
    WHERE id = p_request_id AND status = 'pending_finance';

    -- استدعاء الموافقة الذرية
    RETURN public.approve_continuity_by_finance(p_request_id);
END;
$$;

-- 8) دالة توثيق الطباعة لموظف الطابعة
CREATE OR REPLACE FUNCTION public.mark_continuity_printed(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    UPDATE public.service_continuity_requests
    SET is_printed = TRUE,
        printed_by_id = v_actor_id,
        printed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- تعليم إشعار الطابعة لهذا الموظف كمقروء
    UPDATE public.system_notifications
    SET is_read = TRUE
    WHERE metadata->>'request_id' = p_request_id::text
      AND recipient_id = v_actor_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'تم توثيق طباعة الكتاب بنجاح'
    );
END;
$$;

-- منح الصلاحيات الشاملة وإسناد الملكية إلى supabase_admin
GRANT ALL ON TABLE public.departments TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.service_continuity_requests TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.system_notifications TO postgres, authenticated, service_role;

ALTER FUNCTION public.submit_service_continuity_request(TEXT, BOOLEAN, BOOLEAN, TEXT) OWNER TO supabase_admin;
ALTER FUNCTION public.approve_continuity_by_finance(UUID) OWNER TO supabase_admin;
ALTER FUNCTION public.reject_continuity_by_finance(UUID, TEXT) OWNER TO supabase_admin;
ALTER FUNCTION public.update_and_approve_continuity_by_finance(UUID, TEXT, TEXT) OWNER TO supabase_admin;
ALTER FUNCTION public.mark_continuity_printed(UUID) OWNER TO supabase_admin;
