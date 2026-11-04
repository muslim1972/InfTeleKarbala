-- 1. دالة إعادة تسمية النسخة بأمان مع التحقق من عدم التكرار والصلاحيات
CREATE OR REPLACE FUNCTION public.rename_monthly_snapshot(p_snapshot_id uuid, p_new_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_gov text;
    v_clean_name text;
BEGIN
    PERFORM public.core_require_role(ARRAY['developer','it_supervisor','general','finance']);
    
    v_clean_name := TRIM(p_new_name);
    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'اسم النسخة قصير جداً';
    END IF;

    SELECT governorate INTO v_gov
    FROM public.monthly_snapshots
    WHERE id = p_snapshot_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'النسخة غير موجودة';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.monthly_snapshots 
        WHERE governorate = v_gov AND name = v_clean_name AND id <> p_snapshot_id
    ) THEN
        RAISE EXCEPTION 'يوجد بالفعل نسخة أخرى بهذا الاسم لنفس المحافظة';
    END IF;

    UPDATE public.monthly_snapshots
    SET name = v_clean_name
    WHERE id = p_snapshot_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.rename_monthly_snapshot(uuid, text) TO authenticated;

-- 2. ترقية دالة حذف النسخة بحيث لو كانت النسخة نشطة، تقوم بتفعيل أحدث نسخة سابقة لتلك المحافظة تلقائياً
CREATE OR REPLACE FUNCTION public.delete_monthly_snapshot__impl(p_snapshot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_gov text;
    v_is_active boolean;
    v_prev_id uuid;
BEGIN
    SELECT governorate, is_active INTO v_gov, v_is_active
    FROM public.monthly_snapshots
    WHERE id = p_snapshot_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- إذا كانت النسخة المطلوب حذفها هي النشطة حالياً، نفعّل أحدث نسخة سابقة لتلك المحافظة
    IF v_is_active THEN
        SELECT id INTO v_prev_id
        FROM public.monthly_snapshots
        WHERE governorate = v_gov AND id <> p_snapshot_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_prev_id IS NOT NULL THEN
            UPDATE public.monthly_snapshots SET is_active = true WHERE id = v_prev_id;
        END IF;
    END IF;

    DELETE FROM public.monthly_snapshots WHERE id = p_snapshot_id;
END $function$;

NOTIFY pgrst, 'reload schema';
