-- ============================================================
-- نظام النسخ الشهرية (Monthly Snapshots) - InfTeleKarbala
-- يحفظ لقطات متتابعة لبيانات الموظفين المالية والأساسية
-- ويجعل أي نسخة قابلة للاستعراض/التفعيل من قبل أي مستخدم
-- ============================================================

-- ─── 1) جدول النسخ الرئيسي ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_by uuid,
    created_by_name text,
    source text NOT NULL DEFAULT 'excel',
    financial_count integer NOT NULL DEFAULT 0,
    profile_count integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 2) لقطات السجلات المالية (jsonb مرن يصمد مع أعمدة جديدة) ──
CREATE TABLE IF NOT EXISTS public.monthly_snapshot_financials (
    snapshot_id uuid NOT NULL REFERENCES public.monthly_snapshots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    data jsonb NOT NULL,
    PRIMARY KEY (snapshot_id, user_id)
);

-- ─── 3) لقطات المعلومات الأساسية (بدون الحقول الحساسة) ─────
CREATE TABLE IF NOT EXISTS public.monthly_snapshot_profiles (
    snapshot_id uuid NOT NULL REFERENCES public.monthly_snapshots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    data jsonb NOT NULL,
    PRIMARY KEY (snapshot_id, user_id)
);

-- نسخة معروضة واحدة فقط
CREATE UNIQUE INDEX IF NOT EXISTS monthly_snapshots_one_active
    ON public.monthly_snapshots (is_active) WHERE is_active;

-- ─── 4) دالة مزامنة النسخة المعروضة (حماية التعديلات اليدوية) ──
CREATE OR REPLACE FUNCTION public.sync_active_monthly_snapshot()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_active_id uuid;
BEGIN
    SELECT id INTO v_active_id FROM public.monthly_snapshots WHERE is_active LIMIT 1;
    IF v_active_id IS NULL THEN RETURN; END IF;

    DELETE FROM public.monthly_snapshot_financials WHERE snapshot_id = v_active_id;
    INSERT INTO public.monthly_snapshot_financials (snapshot_id, user_id, data)
    SELECT v_active_id, f.user_id, to_jsonb(f)
    FROM public.financial_records f;

    DELETE FROM public.monthly_snapshot_profiles WHERE snapshot_id = v_active_id;
    INSERT INTO public.monthly_snapshot_profiles (snapshot_id, user_id, data)
    SELECT v_active_id, p.id,
           to_jsonb(p) - ARRAY['password','password_hash','face_descriptor',
             'two_factor_enabled','two_factor_code','two_factor_expires_at',
             'primary_device_id','work_schedule_id','avatar','avatar_url',
             'email','last_login']
    FROM public.profiles p
    WHERE COALESCE(p.job_number, '') <> '';

    UPDATE public.monthly_snapshots SET
        financial_count = (SELECT count(*) FROM public.monthly_snapshot_financials WHERE snapshot_id = v_active_id),
        profile_count   = (SELECT count(*) FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_active_id)
    WHERE id = v_active_id;
END $$;

-- ─── 5) دالة إنشاء نسخة جديدة مسماة من الحالة الحالية ──────
CREATE OR REPLACE FUNCTION public.commit_monthly_snapshot(
    p_name text,
    p_source text DEFAULT 'excel',
    p_creator_name text DEFAULT NULL,
    p_sync_current boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_new_id uuid;
BEGIN
    p_name := btrim(coalesce(p_name, ''));
    IF length(p_name) < 2 THEN
        RAISE EXCEPTION 'اسم النسخة مطلوب (حرفان على الأقل)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.monthly_snapshots WHERE name = p_name) THEN
        RAISE EXCEPTION 'يوجد بالفعل نسخة بهذا الاسم: %', p_name;
    END IF;

    -- مزامنة النسخة المعروضة قبل الالتقاط (إلا إذا مزّمها العميل قبل الحقن)
    IF p_sync_current THEN
        PERFORM public.sync_active_monthly_snapshot();
    END IF;

    UPDATE public.monthly_snapshots SET is_active = false WHERE is_active;

    INSERT INTO public.monthly_snapshots (name, created_by, created_by_name, source, is_active)
    VALUES (p_name, auth.uid(), p_creator_name, coalesce(p_source, 'excel'), true)
    RETURNING id INTO v_new_id;

    INSERT INTO public.monthly_snapshot_financials (snapshot_id, user_id, data)
    SELECT v_new_id, f.user_id, to_jsonb(f)
    FROM public.financial_records f;

    INSERT INTO public.monthly_snapshot_profiles (snapshot_id, user_id, data)
    SELECT v_new_id, p.id,
           to_jsonb(p) - ARRAY['password','password_hash','face_descriptor',
             'two_factor_enabled','two_factor_code','two_factor_expires_at',
             'primary_device_id','work_schedule_id','avatar','avatar_url',
             'email','last_login']
    FROM public.profiles p
    WHERE COALESCE(p.job_number, '') <> '';

    UPDATE public.monthly_snapshots SET
        financial_count = (SELECT count(*) FROM public.monthly_snapshot_financials WHERE snapshot_id = v_new_id),
        profile_count   = (SELECT count(*) FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_new_id)
    WHERE id = v_new_id;

    RETURN v_new_id;
END $$;

-- ─── 6) دالة تفعيل نسخة تاريخية (استعراضها في كل التطبيق) ──
CREATE OR REPLACE FUNCTION public.activate_monthly_snapshot(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    -- EXECUTE لتجنب تخزين خطة الاستعلام لجدول مؤقت يُعاد إنشاؤه بين الاستدعاءات
    EXECUTE 'DROP TABLE IF EXISTS _live_leave_balances';
    EXECUTE 'CREATE TEMP TABLE _live_leave_balances ON COMMIT DROP AS
        SELECT user_id, remaining_leaves_balance, leaves_balance_expiry_date,
               cumulative_minutes_remaining, sick_leaves_balance, unpaid_leaves_total,
               is_five_year_leave, leave_start_date, leave_end_date
        FROM public.financial_records';

    -- 3) استبدال السجلات المالية بمحتوى النسخة المختارة (نفس id لعدم قطع تاريخ الحقول)
    DELETE FROM public.financial_records;
    INSERT INTO public.financial_records
    SELECT jsonb_populate_record(null::public.financial_records, s.data)
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
END $$;

-- ─── 7) دالة حذف نسخة (للمطور عبر الواجهة) ─────────────────
CREATE OR REPLACE FUNCTION public.delete_monthly_snapshot(p_snapshot_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.monthly_snapshots WHERE id = p_snapshot_id AND is_active) THEN
        RAISE EXCEPTION 'لا يمكن حذف النسخة المعروضة حالياً - فعّل نسخة أخرى أولاً';
    END IF;
    DELETE FROM public.monthly_snapshots WHERE id = p_snapshot_id;
END $$;

-- ─── 8) RLS والصلاحيات ─────────────────────────────────────
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshot_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshot_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snapshots_select_authenticated ON public.monthly_snapshots;
CREATE POLICY snapshots_select_authenticated ON public.monthly_snapshots
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS snapshot_financials_select_authenticated ON public.monthly_snapshot_financials;
CREATE POLICY snapshot_financials_select_authenticated ON public.monthly_snapshot_financials
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS snapshot_profiles_select_authenticated ON public.monthly_snapshot_profiles;
CREATE POLICY snapshot_profiles_select_authenticated ON public.monthly_snapshot_profiles
    FOR SELECT TO authenticated USING (true);

-- صلاحية القراءة على مستوى الجدول (RLS لا يكفي وحده دون GRANT)
GRANT SELECT ON public.monthly_snapshots TO authenticated;
GRANT SELECT ON public.monthly_snapshot_financials TO authenticated;
GRANT SELECT ON public.monthly_snapshot_profiles TO authenticated;

-- سحب الصلاحية الافتراضية من PUBLIC (كان بالإمكان لغير المسجلين استدعاء الدوال)
REVOKE EXECUTE ON FUNCTION public.sync_active_monthly_snapshot() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.commit_monthly_snapshot(text, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_monthly_snapshot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_monthly_snapshot(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_active_monthly_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_monthly_snapshot(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_monthly_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_monthly_snapshot(uuid) TO authenticated;

-- ─── 9) النسخة الافتتاحية: شهر حزيران السادس 2026 ──────────
SELECT public.commit_monthly_snapshot('شهر حزيران السادس 2026', 'initial', 'مسلم عقيل', false);
