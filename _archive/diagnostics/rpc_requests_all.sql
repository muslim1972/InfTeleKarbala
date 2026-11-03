CREATE OR REPLACE FUNCTION public.toggle_requests_tab_all(
    p_governorate text,
    p_enable boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v_setting_key text;
BEGIN
    v_setting_key := 'requests_tab_all_enabled_' || p_governorate;

    -- تحديث حقل can_view_requests لجميع الموظفين في المحافظة المحددة
    IF p_enable THEN
        UPDATE public.profiles
        SET can_view_requests = true
        WHERE governorate = p_governorate;
    ELSE
        UPDATE public.profiles
        SET can_view_requests = false
        WHERE governorate = p_governorate;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- حفظ حالة الإعداد في جدول app_settings
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES (
        v_setting_key,
        jsonb_build_object('enabled', p_enable, 'affected_count', v_count, 'governorate', p_governorate),
        now()
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'enabled', p_enable,
        'affected_count', v_count,
        'governorate', p_governorate
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_requests_tab_all_status(
    p_governorate text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_setting_key text;
    v_val jsonb;
    v_total integer;
    v_enabled integer;
BEGIN
    v_setting_key := 'requests_tab_all_enabled_' || p_governorate;
    
    SELECT value INTO v_val
    FROM public.app_settings
    WHERE key = v_setting_key;

    SELECT count(*), count(*) FILTER (WHERE can_view_requests = true)
    INTO v_total, v_enabled
    FROM public.profiles
    WHERE governorate = p_governorate;

    RETURN jsonb_build_object(
        'setting_enabled', COALESCE((v_val->>'enabled')::boolean, false),
        'total_employees', v_total,
        'enabled_employees', v_enabled,
        'is_all_enabled', (v_total > 0 AND v_total = v_enabled) OR COALESCE((v_val->>'enabled')::boolean, false)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_requests_tab_all(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_requests_tab_all_status(text) TO authenticated;
