-- RPC to fetch distinct active visitors within a date range for a specific governorate
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

    WITH filtered_logs AS (
        SELECT 
            p.id AS user_id,
            COALESCE(p.full_name, l.full_name, 'غير محدد') AS full_name,
            COALESCE(
                NULLIF(TRIM(
                    COALESCE(p.dept_text, '') || 
                    CASE 
                        WHEN p.section_text IS NOT NULL AND TRIM(p.section_text) != '' 
                        THEN ' / ' || TRIM(p.section_text) 
                        ELSE '' 
                    END
                ), ''),
                p.dept_text,
                p.section_text,
                'مقر المديرية'
            ) AS workplace,
            MAX(l.login_at) AS last_login_at,
            COUNT(l.id) AS visit_count
        FROM login_logs l
        INNER JOIN profiles p ON l.user_id = p.id
        WHERE (p_governorate IS NULL OR p.governorate = p_governorate)
          AND l.login_at >= v_start_ts
          AND l.login_at < v_end_ts
        GROUP BY p.id, p.full_name, l.full_name, p.dept_text, p.section_text
    )
    SELECT jsonb_build_object(
        'total_visitors', (SELECT COUNT(*) FROM filtered_logs),
        'visitors', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'workplace', workplace,
                    'last_login_at', last_login_at,
                    'visit_count', visit_count
                )
                ORDER BY last_login_at DESC
            )
            FROM filtered_logs
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
