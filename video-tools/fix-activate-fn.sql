-- إصلاح activate_monthly_snapshot - نسخة 2:
-- 1) .* بعد jsonb_populate_record (كانت ناقصة)
-- 2) DELETE بشرط WHERE id IS NOT NULL لأن دور authenticator يحمّل safeupdate
--    الذي يرفض أي DELETE بلا WHERE: "DELETE requires a WHERE clause"
BEGIN;

CREATE OR REPLACE FUNCTION public.activate_monthly_snapshot(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_active_id uuid;
    v_name text;
    v_restored integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.monthly_snapshots WHERE id = p_snapshot_id) THEN
        RAISE EXCEPTION 'النسخة المطلوبة غير موجودة';
    END IF;

    SELECT id INTO v_active_id FROM public.monthly_snapshots WHERE is_active LIMIT 1;
    IF v_active_id = p_snapshot_id THEN
        SELECT name INTO v_name FROM public.monthly_snapshots WHERE id = p_snapshot_id;
        RETURN jsonb_build_object('ok', true, 'message', 'النسخة «' || v_name || '» معروضة أصلاً');
    END IF;

    -- 1) مزامنة النسخة المعروضة الحالية (حماية أي تعديلات يدوية منذ آخر رفع)
    PERFORM public.sync_active_monthly_snapshot();

    -- 2) حفظ أرصدة الإجازات الحية (لا تُرجع للماضي أبداً)
    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    EXECUTE 'CREATE TEMP TABLE _live_leave_balances ON COMMIT DROP AS
        SELECT user_id, remaining_leaves_balance, leaves_balance_expiry_date,
               cumulative_minutes_remaining, sick_leaves_balance, unpaid_leaves_total,
               is_five_year_leave, leave_start_date, leave_end_date
        FROM public.financial_records';

    -- 3) استبدال السجلات المالية بمحتوى النسخة المختارة (نفس id لعدم قطع تاريخ الحقول)
    --    WHERE id IS NOT NULL تعني الكل، وتستوفي شرط safeupdate (منع الحذف بلا WHERE)
    DELETE FROM public.financial_records WHERE id IS NOT NULL;
    INSERT INTO public.financial_records
    SELECT (jsonb_populate_record(null::public.financial_records, s.data)).*
    FROM public.monthly_snapshot_financials s
    WHERE s.snapshot_id = p_snapshot_id;
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    -- 4) إعادة الأرصدة الحية لمن لديه صف في النسخة
    EXECUTE 'UPDATE public.financial_records f SET
        remaining_leaves_balance     = l.remaining_leaves_balance,
        leaves_balance_expiry_date   = l.leaves_balance_expiry_date,
        cumulative_minutes_remaining = l.cumulative_minutes_remaining,
        sick_leaves_balance          = l.sick_leaves_balance,
        unpaid_leaves_total          = l.unpaid_leaves_total,
        is_five_year_leave           = l.is_five_year_leave,
        leave_start_date             = l.leave_start_date,
        leave_end_date               = l.leave_end_date
    FROM _live_leave_balances l
    WHERE l.user_id = f.user_id';

    -- 5) صف بديل لمن انضم بعد النسخة (حتى لا تتعطل شاشاته) بأرصدته الحية
    EXECUTE 'INSERT INTO public.financial_records (user_id, updated_at, remaining_leaves_balance,
        leaves_balance_expiry_date, cumulative_minutes_remaining, sick_leaves_balance,
        unpaid_leaves_total, is_five_year_leave, leave_start_date, leave_end_date)
    SELECT l.user_id, now(), l.remaining_leaves_balance, l.leaves_balance_expiry_date,
           COALESCE(l.cumulative_minutes_remaining, 0), COALESCE(l.sick_leaves_balance, 30),
           COALESCE(l.unpaid_leaves_total, 0), COALESCE(l.is_five_year_leave, false),
           l.leave_start_date, l.leave_end_date
    FROM _live_leave_balances l
    LEFT JOIN public.financial_records f ON f.user_id = l.user_id
    WHERE f.user_id IS NULL';

    -- 6) تحديث المعلومات الأساسية من النسخة (jsonb_populate_record يضمن أنواع الأعمدة)
    UPDATE public.profiles p SET
        full_name        = s.full_name,
        job_number       = s.job_number,
        graduation_year  = s.graduation_year,
        specialization   = s.specialization,
        work_nature      = s.work_nature,
        appointment_date = s.appointment_date,
        dept_text        = s.dept_text,
        section_text     = s.section_text,
        unit_text        = s.unit_text,
        updated_at       = now()
    FROM (
        SELECT (jsonb_populate_record(null::public.profiles, m.data)).*,
               m.user_id AS match_id
        FROM public.monthly_snapshot_profiles m
        WHERE m.snapshot_id = p_snapshot_id
    ) s
    WHERE s.match_id = p.id;

    -- 7) تبديل النسخة المعروضة
    UPDATE public.monthly_snapshots SET is_active = false WHERE is_active;
    UPDATE public.monthly_snapshots SET is_active = true WHERE id = p_snapshot_id;
    SELECT name INTO v_name FROM public.monthly_snapshots WHERE id = p_snapshot_id;

    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    RETURN jsonb_build_object('ok', true, 'restored', v_restored, 'name', v_name);
END $function$;

COMMIT;
