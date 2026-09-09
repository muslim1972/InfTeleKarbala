-- commit_monthly_snapshot نسخة 2: إن الاسم موجود مسبقاً → استبدال (Replacement)
-- يُحفظ المحتوى الحالي (بعد حقن الإكسل) بدل محتوى النسخة القديمة، وتبقى/تصبح معروضة.
BEGIN;
CREATE OR REPLACE FUNCTION public.commit_monthly_snapshot(p_name text, p_source text DEFAULT 'excel', p_creator_name text DEFAULT NULL, p_sync_current boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_id uuid;
    v_existing uuid;
BEGIN
    p_name := btrim(coalesce(p_name, ''));
    IF length(p_name) < 2 THEN
        RAISE EXCEPTION 'اسم النسخة مطلوب (حرفان على الأقل)';
    END IF;

    -- مزامنة النسخة المعروضة قبل الالتقاط (إلا إذا مزّمها العميل قبل الحقن)
    IF p_sync_current THEN
        PERFORM public.sync_active_monthly_snapshot();
    END IF;

    -- اسم موجود مسبقاً؟ → استبدال (Replacement): الملف الجديد يُحفظ بدل القديم
    SELECT id INTO v_existing FROM public.monthly_snapshots WHERE name = p_name FOR UPDATE;
    IF v_existing IS NOT NULL THEN
        v_id := v_existing;
        DELETE FROM public.monthly_snapshot_financials WHERE snapshot_id = v_id;
        DELETE FROM public.monthly_snapshot_profiles WHERE snapshot_id = v_id;
        -- ترتيب مهم: قيد unique على السطر النشط الواحد يفرض إلغاء الآخرين أولاً
        UPDATE public.monthly_snapshots SET is_active = false WHERE is_active AND id <> v_id;
        UPDATE public.monthly_snapshots SET
            source = coalesce(p_source, source),
            created_by = auth.uid(),
            created_by_name = coalesce(p_creator_name, created_by_name),
            created_at = now(),
            is_active = true
        WHERE id = v_id;
    ELSE
        -- نسخة جديدة: تُعتمد وتصبح المعروضة (إلغاء الآخرين أولاً لقيد النشط الواحد)
        UPDATE public.monthly_snapshots SET is_active = false WHERE is_active;
        INSERT INTO public.monthly_snapshots (name, created_by, created_by_name, source, is_active)
        VALUES (p_name, auth.uid(), p_creator_name, coalesce(p_source, 'excel'), true)
        RETURNING id INTO v_id;
    END IF;

    INSERT INTO public.monthly_snapshot_financials (snapshot_id, user_id, data)
    SELECT v_id, f.user_id, to_jsonb(f)
    FROM public.financial_records f;

    INSERT INTO public.monthly_snapshot_profiles (snapshot_id, user_id, data)
    SELECT v_id, p.id,
           to_jsonb(p) - ARRAY['password','password_hash','face_descriptor',
             'two_factor_enabled','two_factor_code','two_factor_expires_at',
             'primary_device_id','work_schedule_id','avatar','avatar_url',
             'email','last_login']
    FROM public.profiles p
    WHERE COALESCE(p.job_number, '') <> '';

    UPDATE public.monthly_snapshots SET
        financial_count = (SELECT count(*) FROM public.monthly_snapshot_financials WHERE snapshot_id = v_id),
        profile_count   = (SELECT count(*) FROM public.monthly_snapshot_profiles  WHERE snapshot_id = v_id)
    WHERE id = v_id;

    RETURN v_id;
END $function$;
COMMIT;
