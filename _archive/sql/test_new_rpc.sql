DO $$
DECLARE
    p_start_date DATE := CURRENT_DATE - 7;
    p_end_date DATE := CURRENT_DATE;
    p_governorate TEXT := 'karbala';
    v_start_ts TIMESTAMPTZ;
    v_end_ts TIMESTAMPTZ;
    v_total_staff INT;
    v_active_count INT;
    v_inactive_count INT;
    v_pwa_count INT;
    v_browser_count INT;
BEGIN
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
    )
    SELECT 
        COUNT(*),
        COUNT(pl.user_id),
        COUNT(*) - COUNT(pl.user_id),
        COUNT(*) FILTER (WHERE pl.is_pwa IS TRUE),
        COUNT(*) FILTER (WHERE pl.user_id IS NOT NULL AND (pl.is_pwa IS FALSE OR pl.is_pwa IS NULL))
    INTO v_total_staff, v_active_count, v_inactive_count, v_pwa_count, v_browser_count
    FROM active_staff s
    LEFT JOIN period_logs pl ON s.user_id = pl.user_id;

    RAISE NOTICE 'Total Staff: %, Active: %, Inactive: %, PWA: %, Browser: %', 
        v_total_staff, v_active_count, v_inactive_count, v_pwa_count, v_browser_count;
END $$;
