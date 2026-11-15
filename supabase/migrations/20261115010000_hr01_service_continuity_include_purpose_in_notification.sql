-- ==============================================================================
-- Migration: 20261115010000_hr01_service_continuity_include_purpose_in_notification.sql
-- Kernel: BE-HR-01
-- Purpose: Include purpose/notes in the notification content for Finance Managers
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
    v_nominal NUMERIC(12, 2) := 0;
    v_gross NUMERIC(12, 2) := 0;
    v_net NUMERIC(12, 2) := 0;
    v_finance_dept_id UUID;
    v_finance_manager_id UUID;
    v_finance_deputy_id UUID;
    v_req_id UUID;
    v_user_name TEXT;
    v_include_all BOOLEAN := FALSE;
    v_notif_body TEXT;
    v_clean_notes TEXT;
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
    v_clean_notes := NULLIF(TRIM(p_notes), '');

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
        v_clean_notes,
        'pending_finance',
        COALESCE(v_finance_manager_id, v_finance_deputy_id),
        v_gov
    ) RETURNING id INTO v_req_id;

    -- صياغة نص الإشعار متضمناً الغرض إن وُجد
    IF v_clean_notes IS NOT NULL THEN
        v_notif_body := format('قدم الموظف (%s) طلب تأييد استمرار بالخدمة معنون إلى (%s) - الغرض: (%s)', v_user_name, TRIM(p_destination_entity), v_clean_notes);
    ELSE
        v_notif_body := format('قدم الموظف (%s) طلب تأييد استمرار بالخدمة معنون إلى (%s)', v_user_name, TRIM(p_destination_entity));
    END IF;

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
            v_notif_body,
            'service_continuity_finance',
            jsonb_build_object(
                'request_id', v_req_id,
                'requester_name', v_user_name,
                'destination_entity', TRIM(p_destination_entity),
                'has_salary', v_include_all,
                'notes', v_clean_notes,
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
            v_notif_body,
            'service_continuity_finance',
            jsonb_build_object(
                'request_id', v_req_id,
                'requester_name', v_user_name,
                'destination_entity', TRIM(p_destination_entity),
                'has_salary', v_include_all,
                'notes', v_clean_notes,
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

ALTER FUNCTION public.submit_service_continuity_request(TEXT, BOOLEAN, BOOLEAN, TEXT) OWNER TO supabase_admin;
