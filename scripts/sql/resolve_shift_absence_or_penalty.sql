-- إنشاء دالة معالجة قرارات المسؤول عن غياب أو تأخير الشفتات
CREATE OR REPLACE FUNCTION public.resolve_shift_absence_or_penalty(
    p_notification_id uuid,
    p_decision text -- 'approve_leave' أو 'unexcused_absence'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_notif RECORD;
    v_meta JSONB;
    v_emp_id UUID;
    v_date DATE;
    v_shift TEXT;
    v_days INT;
    v_reason TEXT;
    v_manager_name TEXT;
    v_emp_name TEXT;
    v_shift_ar TEXT;
BEGIN
    SELECT * INTO v_notif FROM public.system_notifications WHERE id = p_notification_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الإشعار غير موجود');
    END IF;

    v_meta := v_notif.metadata;
    v_emp_id := (v_meta->>'employee_id')::UUID;
    v_date := (v_meta->>'record_date')::DATE;
    v_shift := COALESCE(v_meta->>'shift_type', 'evening');
    v_days := COALESCE((v_meta->>'days_count')::INT, 1);
    v_reason := COALESCE(v_meta->>'reason', '');

    SELECT full_name INTO v_manager_name FROM public.profiles WHERE id = auth.uid();
    SELECT full_name INTO v_emp_name FROM public.profiles WHERE id = v_emp_id;

    IF v_shift = 'evening' THEN
        v_shift_ar := 'الشفت المسائي';
    ELSIF v_shift = 'night' THEN
        v_shift_ar := 'شفت الخفر';
    ELSE
        v_shift_ar := 'الشفت الصباحي';
    END IF;

    IF p_decision = 'approve_leave' THEN
        -- 1. التأكد من وجود إجازة اعتيادية معتمدة للموظف
        IF NOT EXISTS (
            SELECT 1 FROM public.leave_requests 
            WHERE user_id = v_emp_id 
              AND start_date = v_date 
              AND leave_type = 'regular' 
              AND status = 'approved'
        ) THEN
            INSERT INTO public.leave_requests (
                user_id, leave_type, start_date, end_date, days_count,
                status, leave_status, is_mandatory, with_request,
                reason, supervisor_id
            ) VALUES (
                v_emp_id, 'regular', v_date, v_date, v_days,
                'approved', 'approved', true, false,
                'اعتماد تغيب/تأخر ' || v_shift_ar || ' كإجازة اعتيادية بقرار المسؤول (' || COALESCE(v_manager_name, 'المسؤول') || ')',
                auth.uid()
            );
        ELSE
            UPDATE public.leave_requests
            SET reason = reason || ' [تم اعتمادها رسمياً كإجازة اعتيادية بقرار المسؤول: ' || COALESCE(v_manager_name, '') || ']'
            WHERE user_id = v_emp_id AND start_date = v_date AND leave_type = 'regular' AND status = 'approved';
        END IF;

        -- 2. إشعار الموظف بالعلم
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata
        ) VALUES (
            v_emp_id, auth.uid(), 'system',
            'قرار المسؤول: اعتماد إجازة اعتيادية',
            'اعتمد مسؤولك (' || COALESCE(v_manager_name, 'المسؤول المباشر') || ') عدم حضورك/تأخرك في ' || v_shift_ar || ' ليوم ' || v_date::text || ' كإجازة اعتيادية براتب، وتم خصم (' || v_days::text || ') يوم من رصيدك.',
            jsonb_build_object('type', 'absence_resolved_leave', 'date', v_date, 'days', v_days, 'shift', v_shift)
        );

        -- 3. تحديث الإشعار كمقروء
        UPDATE public.system_notifications
        SET is_read = true,
            metadata = jsonb_set(COALESCE(v_meta, '{}'::jsonb), '{resolved_decision}', '"approve_leave"')
        WHERE id = p_notification_id;

        RETURN jsonb_build_object('success', true, 'message', 'تم اعتماد الحالة كإجازة اعتيادية براتب بنجاح');

    ELSIF p_decision = 'unexcused_absence' THEN
        -- 1. إلغاء أي إجازة اعتيادية إجبارية كانت قد سُجلت لهذا الشفت
        UPDATE public.leave_requests
        SET status = 'canceled',
            leave_status = 'rejected',
            reason = reason || ' [أُلغيت بقرار المسؤول وتحولت إلى غياب رسمي بدون راتب]'
        WHERE user_id = v_emp_id AND start_date = v_date AND leave_type = 'regular' AND is_mandatory = true;

        -- 2. تحديث سجل الحضور في attendance_records ليصبح غياباً
        UPDATE public.attendance_records
        SET status = 'absent',
            notes = 'غياب غير مبرر بقرار المسؤول (' || COALESCE(v_manager_name, 'المسؤول') || ') عن ' || v_shift_ar || ' (' || v_days::text || ' يوم)'
        WHERE employee_id = v_emp_id AND (check_in::date = v_date OR created_at::date = v_date);

        -- 3. إشعار الموظف بالعلم
        INSERT INTO public.system_notifications (
            recipient_id, sender_id, type, title, content, metadata
        ) VALUES (
            v_emp_id, auth.uid(), 'system',
            'قرار المسؤول: تسجيل غياب غير مبرر',
            'قرر مسؤولك (' || COALESCE(v_manager_name, 'المسؤول المباشر') || ') تسجيل عدم حضورك/تأخرك في ' || v_shift_ar || ' ليوم ' || v_date::text || ' كغياب غير مبرر (' || v_days::text || ' يوم) بدون راتب.',
            jsonb_build_object('type', 'absence_resolved_unexcused', 'date', v_date, 'days', v_days, 'shift', v_shift)
        );

        -- 4. تحديث الإشعار كمقروء
        UPDATE public.system_notifications
        SET is_read = true,
            metadata = jsonb_set(COALESCE(v_meta, '{}'::jsonb), '{resolved_decision}', '"unexcused_absence"')
        WHERE id = p_notification_id;

        RETURN jsonb_build_object('success', true, 'message', 'تم تسجيل الحالة كغياب رسمي بدون راتب بنجاح');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'إجراء غير معروف');
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_shift_absence_or_penalty(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_shift_absence_or_penalty(uuid, text) TO authenticated;
