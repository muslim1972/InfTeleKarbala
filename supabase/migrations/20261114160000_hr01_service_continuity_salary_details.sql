-- ==============================================================================
-- Migration: 20261114160000_hr01_service_continuity_salary_details.sql
-- Kernel: BE-HR-01
-- Purpose: Support unified Salary Details (Gross, Net, Nominal) in service_continuity_requests
-- ==============================================================================

-- 1) إضافة الأعمدة الجديدة لدعم تفاصيل الراتب الثلاثية
ALTER TABLE public.service_continuity_requests
ADD COLUMN IF NOT EXISTS gross_salary_snapshot NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_salary_details BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) تحديث دالة التقديم لحفظ الرواتب الثلاثة دفعة واحدة
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
    v_supervisor_id UUID;
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

    -- سحب البيانات المالية المعتمدة إن طُلبت (الاسمي، الكلي، الصافي)
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

    -- تحديد المسؤول المباشر عبر محرك السلسلة الهرمية
    SELECT manager_id INTO v_supervisor_id
    FROM public.core_resolve_approval_chain(v_user_id)
    ORDER BY step_order ASC
    LIMIT 1;

    -- إدراج الطلب مع لقطات الرواتب الثلاثة
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
        'pending_supervisor',
        v_supervisor_id,
        v_gov
    )
    RETURNING id INTO v_req_id;

    -- إشعار المسؤول المباشر
    IF v_supervisor_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            title,
            body,
            type,
            data
        ) VALUES (
            v_supervisor_id,
            'طلب تأييد استمرارية بالخدمة جديد',
            'قدم الموظف (' || COALESCE(v_user_name, 'موظف') || ') طلب تأييد استمرارية بالخدمة معنون إلى (' || TRIM(p_destination_entity) || ') بانتظار موافقتك.',
            'request_submitted',
            jsonb_build_object(
                'request_id', v_req_id,
                'request_type', 'service_continuity',
                'action_url', '/admin?tab=requests&highlight=' || v_req_id::text
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req_id,
        'message', 'تم تقديم طلب تأييد الاستمرارية بنجاح'
    );
END;
$$;
