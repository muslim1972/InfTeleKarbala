-- ترقية النظام لتعدد المحافظات (بابل ثم الباقي)
BEGIN;

-- 1) عمود المحافظة في السجلات المالية (القيم الحالية = كربلاء)
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS governorate text NOT NULL DEFAULT 'karbala';
ALTER TABLE public.monthly_snapshots ADD COLUMN IF NOT EXISTS governorate text NOT NULL DEFAULT 'karbala';

-- 2) قيود فريدة لكل محافظة بدل القيود العامة
ALTER TABLE public.monthly_snapshots DROP CONSTRAINT IF EXISTS monthly_snapshots_name_key;
DROP INDEX IF EXISTS public.monthly_snapshots_name_key;
DROP INDEX IF EXISTS public.monthly_snapshots_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS monthly_snapshots_gov_name_key ON public.monthly_snapshots (governorate, name);
CREATE UNIQUE INDEX IF NOT EXISTS monthly_snapshots_one_active_gov ON public.monthly_snapshots (governorate) WHERE is_active;

-- 3) بطاقات المحافظات (تتحكم بواجهة الاختيار)
CREATE TABLE IF NOT EXISTS public.governorate_cards (
    id text PRIMARY KEY,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    activated_at timestamptz
);
INSERT INTO public.governorate_cards (id, name, is_active, activated_at)
VALUES ('karbala', 'كربلاء المقدسة', true, now())
ON CONFLICT (id) DO UPDATE SET is_active = true, activated_at = COALESCE(public.governorate_cards.activated_at, now());

ALTER TABLE public.governorate_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS governorate_cards_read ON public.governorate_cards;
CREATE POLICY governorate_cards_read ON public.governorate_cards FOR SELECT TO authenticated USING (true);

-- 4) تفعيل بطاقة محافظة (للمطور فقط — تُستدعى تلقائياً بعد أول رفع ناجح)
CREATE OR REPLACE FUNCTION public.enable_governorate_card(p_governorate text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'غير مصرح'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND admin_role = 'developer') THEN
        RAISE EXCEPTION 'هذه العملية للمطور فقط';
    END IF;
    UPDATE public.governorate_cards SET is_active = true, activated_at = now() WHERE id = p_governorate;
    IF NOT FOUND THEN RAISE EXCEPTION 'محافظة غير معروفة: %', p_governorate; END IF;
    RETURN true;
END $function$;

-- 5) مزامنة النسخة المعروضة لمحافظة محددة
CREATE OR REPLACE FUNCTION public.sync_active_monthly_snapshot(p_governorate text DEFAULT 'karbala')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_active_id uuid;
BEGIN
    SELECT id INTO v_active_id FROM public.monthly_snapshots
    WHERE is_active AND governorate = p_governorate LIMIT 1;
    IF v_active_id IS NULL THEN RETURN; END IF;

    DELETE FROM public.monthly_snapshot_financials WHERE snapshot_id = v_active_id;
    INSERT INTO public.monthly_snapshot_financials (snapshot_id, user_id, data)
    SELECT v_active_id, f.user_id, to_jsonb(f)
    FROM public.financial_records f WHERE f.governorate = p_governorate;

    DELETE FROM public.monthly_snapshot_profiles WHERE snapshot_id = v_active_id;
    INSERT INTO public.monthly_snapshot_profiles (snapshot_id, user_id, data)
    SELECT v_active_id, p.id, to_jsonb(p) - ARRAY['password','password_hash','face_descriptor',
        'two_factor_enabled','two_factor_code','two_factor_expires_at','primary_device_id',
        'work_schedule_id','avatar','avatar_url','email','last_login']
    FROM public.profiles p
    WHERE COALESCE(p.job_number, '') <> '' AND p.governorate = p_governorate;

    UPDATE public.monthly_snapshots SET
        financial_count = (SELECT count(*) FROM public.monthly_snapshot_financials WHERE snapshot_id = v_active_id),
        profile_count   = (SELECT count(*) FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_active_id)
    WHERE id = v_active_id;
END $function$;

-- 6) اعتماد نسخة شهرية لمحافظة (إنشاء أو استبدال بنفس الاسم)
CREATE OR REPLACE FUNCTION public.commit_monthly_snapshot(
    p_name text,
    p_source text DEFAULT 'excel',
    p_creator_name text DEFAULT NULL,
    p_governorate text DEFAULT 'karbala',
    p_sync_current boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid; v_existing uuid;
BEGIN
    p_name := btrim(coalesce(p_name, ''));
    IF length(p_name) < 2 THEN RAISE EXCEPTION 'اسم النسخة مطلوب (حرفان على الأقل)'; END IF;
    IF p_sync_current THEN PERFORM public.sync_active_monthly_snapshot(p_governorate); END IF;

    SELECT id INTO v_existing FROM public.monthly_snapshots
    WHERE name = p_name AND governorate = p_governorate FOR UPDATE;

    IF v_existing IS NOT NULL THEN
        v_id := v_existing;
        DELETE FROM public.monthly_snapshot_financials WHERE snapshot_id = v_id;
        DELETE FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_id;
        UPDATE public.monthly_snapshots SET is_active = false
        WHERE is_active AND governorate = p_governorate AND id <> v_id;
        UPDATE public.monthly_snapshots SET
            source = coalesce(p_source, source),
            created_by = auth.uid(),
            created_by_name = coalesce(p_creator_name, created_by_name),
            created_at = now(),
            is_active = true
        WHERE id = v_id;
    ELSE
        UPDATE public.monthly_snapshots SET is_active = false
        WHERE is_active AND governorate = p_governorate;
        INSERT INTO public.monthly_snapshots (name, created_by, created_by_name, source, is_active, governorate)
        VALUES (p_name, auth.uid(), p_creator_name, coalesce(p_source, 'excel'), true, p_governorate)
        RETURNING id INTO v_id;
    END IF;

    INSERT INTO public.monthly_snapshot_financials (snapshot_id, user_id, data)
    SELECT v_id, f.user_id, to_jsonb(f)
    FROM public.financial_records f WHERE f.governorate = p_governorate;

    INSERT INTO public.monthly_snapshot_profiles (snapshot_id, user_id, data)
    SELECT v_id, p.id, to_jsonb(p) - ARRAY['password','password_hash','face_descriptor',
        'two_factor_enabled','two_factor_code','two_factor_expires_at','primary_device_id',
        'work_schedule_id','avatar','avatar_url','email','last_login']
    FROM public.profiles p
    WHERE COALESCE(p.job_number, '') <> '' AND p.governorate = p_governorate;

    UPDATE public.monthly_snapshots SET
        financial_count = (SELECT count(*) FROM public.monthly_snapshot_financials WHERE snapshot_id = v_id),
        profile_count   = (SELECT count(*) FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_id)
    WHERE id = v_id;

    RETURN v_id;
END $function$;

-- 7) تفعيل نسخة تاريخية (استبدال بيانات المحافظة التابعة للنسخة فقط)
CREATE OR REPLACE FUNCTION public.activate_monthly_snapshot(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
    v_active_id uuid;
    v_name text;
    v_gov text;
    v_restored integer := 0;
BEGIN
    SELECT governorate INTO v_gov FROM public.monthly_snapshots WHERE id = p_snapshot_id;
    IF v_gov IS NULL THEN
        RAISE EXCEPTION 'النسخة المطلوبة غير موجودة';
    END IF;

    SELECT id INTO v_active_id FROM public.monthly_snapshots
    WHERE is_active AND governorate = v_gov LIMIT 1;
    IF v_active_id = p_snapshot_id THEN
        SELECT name INTO v_name FROM public.monthly_snapshots WHERE id = p_snapshot_id;
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
        FROM public.financial_records WHERE governorate = $1' USING v_gov;

    -- 3) استبدال سجلات هذه المحافظة فقط بمحتوى النسخة
    DELETE FROM public.financial_records WHERE governorate = v_gov;
    INSERT INTO public.financial_records
    SELECT (jsonb_populate_record(null::public.financial_records,
               s.data || jsonb_build_object('governorate', v_gov))).*
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

    -- 5) صف بديل لمن انضم بعد النسخة (بنفس المحافظة) بأرصدته الحية
    EXECUTE 'INSERT INTO public.financial_records (user_id, governorate, updated_at,
        remaining_leaves_balance, leaves_balance_expiry_date, cumulative_minutes_remaining,
        sick_leaves_balance, unpaid_leaves_total, is_five_year_leave, leave_start_date, leave_end_date)
    SELECT l.user_id, $1, now(), l.remaining_leaves_balance, l.leaves_balance_expiry_date,
           COALESCE(l.cumulative_minutes_remaining, 0), COALESCE(l.sick_leaves_balance, 30),
           COALESCE(l.unpaid_leaves_total, 0), COALESCE(l.is_five_year_leave, false),
           l.leave_start_date, l.leave_end_date
    FROM _live_leave_balances l
    LEFT JOIN public.financial_records f ON f.user_id = l.user_id
    WHERE f.user_id IS NULL' USING v_gov;

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
    WHERE s.match_id = p.id AND p.governorate = v_gov;

    -- 7) تبديل النسخة المعروضة (داخل نفس المحافظة)
    UPDATE public.monthly_snapshots SET is_active = false WHERE is_active AND governorate = v_gov;
    UPDATE public.monthly_snapshots SET is_active = true WHERE id = p_snapshot_id;
    SELECT name INTO v_name FROM public.monthly_snapshots WHERE id = p_snapshot_id;

    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    RETURN jsonb_build_object('ok', true, 'restored', v_restored, 'name', v_name);
END $function$;

COMMIT;
