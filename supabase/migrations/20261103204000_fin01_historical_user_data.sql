-- ============================================================
-- BE-FIN-01: منظومة المعاينة التاريخية للقراءة فقط (Historical Read-Only Inspection Engine)
-- 1) دالة get_historical_user_data لجلب بيانات موظف محدد في شهر تاريخي محدد دون مساس بالجداول الحية
-- 2) تحصين دالة activate_monthly_snapshot ضد انهيارات المفتاح الخارجي (financial_records_user_id_fkey)
-- ============================================================

BEGIN;

-- 1) دالة الاستعلام التاريخي الآمنة
CREATE OR REPLACE FUNCTION public.get_historical_user_data(
    p_snapshot_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_role text;
    v_is_admin boolean := false;
    v_fin jsonb;
    v_prof jsonb;
    v_snap_name text;
    v_snap_gov text;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'unauthorized: session required' USING ERRCODE = '42501';
    END IF;

    -- التحقق إن كان المستدعي إدارياً مخولاً
    v_role := coalesce(public.get_my_admin_role(), '');
    IF v_role IN ('developer', 'it_supervisor', 'general', 'finance', 'hr', 'hr_supervisor', 'attendance_supervisor', 'biometric') THEN
        v_is_admin := true;
    END IF;

    -- منع أي مستخدم عادي من قراءة بيانات موظف آخر
    IF v_caller <> p_target_user_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'forbidden: you can only view your own historical records' USING ERRCODE = '42501';
    END IF;

    -- التحقق من وجود النسخة المطلوبة
    SELECT name, governorate INTO v_snap_name, v_snap_gov
    FROM public.monthly_snapshots
    WHERE id = p_snapshot_id;

    IF v_snap_name IS NULL THEN
        RAISE EXCEPTION 'النسخة التاريخية المطلوبة غير موجودة';
    END IF;

    -- جلب السجل المالي التاريخي للموظف المحدد
    SELECT data INTO v_fin
    FROM public.monthly_snapshot_financials
    WHERE snapshot_id = p_snapshot_id AND user_id = p_target_user_id;

    -- جلب السجل الوظيفي والأساسي التاريخي للموظف المحدد
    SELECT data INTO v_prof
    FROM public.monthly_snapshot_profiles
    WHERE snapshot_id = p_snapshot_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object(
        'ok', true,
        'snapshot_id', p_snapshot_id,
        'snapshot_name', v_snap_name,
        'governorate', v_snap_gov,
        'user_id', p_target_user_id,
        'financial', v_fin,
        'profile', v_prof
    );
END $$;

REVOKE ALL ON FUNCTION public.get_historical_user_data(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_historical_user_data(uuid, uuid) TO authenticated, service_role;

-- 2) تحصين دالة activate_monthly_snapshot__impl إن كانت مستخدمة كخلفية إدارية
CREATE OR REPLACE FUNCTION public.activate_monthly_snapshot__impl(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_active_id uuid;
    v_name text;
    v_gov text;
    v_restored integer := 0;
BEGIN
    SELECT governorate, name INTO v_gov, v_name FROM public.monthly_snapshots WHERE id = p_snapshot_id;
    IF v_name IS NULL THEN
        RAISE EXCEPTION 'النسخة المطلوبة غير موجودة';
    END IF;

    v_gov := coalesce(v_gov, 'karbala');

    SELECT id INTO v_active_id FROM public.monthly_snapshots
    WHERE is_active AND governorate = v_gov LIMIT 1;
    IF v_active_id = p_snapshot_id THEN
        RETURN jsonb_build_object('ok', true, 'message', 'النسخة «' || v_name || '» معروضة أصلاً');
    END IF;

    -- 1) مزامنة النسخة المعروضة الحالية لنفس المحافظة
    PERFORM public.sync_active_monthly_snapshot(v_gov);

    -- 2) حفظ أرصدة الإجازات الحية لهذه المحافظة فقط
    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    EXECUTE 'CREATE TEMP TABLE _live_leave_balances ON COMMIT DROP AS
        SELECT user_id, remaining_leaves_balance, leaves_balance_expiry_date,
               cumulative_minutes_remaining, sick_leaves_balance, unpaid_leaves_total,
               is_five_year_leave, leave_start_date, leave_end_date
        FROM public.financial_records WHERE coalesce(governorate, ''karbala'') = $1' USING v_gov;

    -- 3) استبدال سجلات هذه المحافظة فقط مع التحقق الحتمي من وجود الموظف في profiles (منع كسر المفتاح الخارجي)
    DELETE FROM public.financial_records WHERE coalesce(governorate, 'karbala') = v_gov;
    INSERT INTO public.financial_records
    SELECT (jsonb_populate_record(null::public.financial_records,
               s.data || jsonb_build_object('governorate', v_gov))).*
    FROM public.monthly_snapshot_financials s
    WHERE s.snapshot_id = p_snapshot_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.user_id);
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

    -- 5) صف بديل لمن انضم بعد النسخة (بشرط وجوده في profiles أيضاً)
    EXECUTE 'INSERT INTO public.financial_records (user_id, governorate, updated_at,
        remaining_leaves_balance, leaves_balance_expiry_date, cumulative_minutes_remaining,
        sick_leaves_balance, unpaid_leaves_total, is_five_year_leave, leave_start_date, leave_end_date)
    SELECT l.user_id, $1, now(), l.remaining_leaves_balance, l.leaves_balance_expiry_date,
           COALESCE(l.cumulative_minutes_remaining, 0), COALESCE(l.sick_leaves_balance, 30),
           COALESCE(l.unpaid_leaves_total, 0), COALESCE(l.is_five_year_leave, false),
           l.leave_start_date, l.leave_end_date
    FROM _live_leave_balances l
    LEFT JOIN public.financial_records f ON f.user_id = l.user_id
    WHERE f.user_id IS NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.user_id)' USING v_gov;

    -- 6) تحديث المعلومات الأساسية (مستخدمو هذه المحافظة فقط)
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
    WHERE s.match_id = p.id AND coalesce(p.governorate, 'karbala') = v_gov;

    -- 7) تبديل النسخة المعروضة (داخل نفس المحافظة)
    UPDATE public.monthly_snapshots SET is_active = false WHERE is_active AND coalesce(governorate, 'karbala') = v_gov;
    UPDATE public.monthly_snapshots SET is_active = true WHERE id = p_snapshot_id;

    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    RETURN jsonb_build_object('ok', true, 'restored', v_restored, 'name', v_name);
END $function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
