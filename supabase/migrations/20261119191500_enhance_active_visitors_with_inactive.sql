CREATE OR REPLACE FUNCTION get_active_visitors_by_range(
    p_start_date DATE,
    p_end_date DATE,
    p_governorate TEXT DEFAULT 'karbala'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_ts TIMESTAMPTZ;
    v_end_ts TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Set timestamps for full days in Iraq timezone (UTC+3)
    v_start_ts := (p_start_date::text || ' 00:00:00+03')::TIMESTAMPTZ;
    v_end_ts := ((p_end_date + 1)::text || ' 00:00:00+03')::TIMESTAMPTZ;

    WITH active_staff AS (
        SELECT 
            p.id AS user_id,
            p.full_name,
            COALESCE(
                NULLIF(TRIM(
                    COALESCE(p.dept_text, '') || 
                    CASE 
                        WHEN p.section_text IS NOT NULL AND TRIM(p.section_text) != '' 
                        THEN ' / ' || TRIM(p.section_text) 
                        ELSE '' 
                    END
                ), ''),
                NULLIF(TRIM(p.dept_text), ''),
                NULLIF(TRIM(p.section_text), ''),
                'مقر المديرية'
            ) AS workplace
        FROM profiles p
        WHERE (p_governorate IS NULL OR p.governorate = p_governorate)
          AND (p.is_retired IS FALSE OR p.is_retired IS NULL)
    ),
    period_logs AS (
        SELECT 
            l.user_id,
            MAX(l.login_at) AS last_login_at,
            COUNT(l.id) AS visit_count,
            (ARRAY_AGG(COALESCE(l.is_pwa, false) ORDER BY l.login_at DESC))[1] AS is_pwa
        FROM login_logs l
        WHERE l.login_at >= v_start_ts AND l.login_at < v_end_ts
        GROUP BY l.user_id
    ),
    historical_last_seen AS (
        SELECT 
            l.user_id,
            MAX(l.login_at) AS last_seen_at
        FROM login_logs l
        GROUP BY l.user_id
    ),
    active_visitors AS (
        SELECT 
            s.user_id,
            s.full_name,
            s.workplace,
            pl.last_login_at,
            pl.visit_count,
            COALESCE(pl.is_pwa, false) AS is_pwa
        FROM active_staff s
        INNER JOIN period_logs pl ON s.user_id = pl.user_id
    ),
    inactive_staff AS (
        SELECT 
            s.user_id,
            s.full_name,
            s.workplace,
            hl.last_seen_at,
            0 AS visit_count,
            false AS is_pwa
        FROM active_staff s
        LEFT JOIN period_logs pl ON s.user_id = pl.user_id
        LEFT JOIN historical_last_seen hl ON s.user_id = hl.user_id
        WHERE pl.user_id IS NULL
    )
    SELECT jsonb_build_object(
        'total_staff', (SELECT COUNT(*) FROM active_staff),
        'total_visitors', (SELECT COUNT(*) FROM active_visitors),
        'inactive_count', (SELECT COUNT(*) FROM inactive_staff),
        'pwa_count', (SELECT COUNT(*) FROM active_visitors WHERE is_pwa = true),
        'browser_count', (SELECT COUNT(*) FROM active_visitors WHERE is_pwa = false),
        'visitors', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'workplace', workplace,
                    'last_login_at', last_login_at,
                    'visit_count', visit_count,
                    'is_pwa', is_pwa
                )
                ORDER BY last_login_at DESC
            )
            FROM active_visitors
        ), '[]'::jsonb),
        'inactive_users', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'workplace', workplace,
                    'last_seen_at', last_seen_at,
                    'visit_count', 0,
                    'is_pwa', false
                )
                ORDER BY full_name ASC
            )
            FROM inactive_staff
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_visitors_by_range(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_visitors_by_range(date, date, text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
