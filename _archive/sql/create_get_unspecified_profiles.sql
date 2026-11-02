-- RPC to fetch unspecified gender profiles for HR audit
CREATE OR REPLACE FUNCTION get_unspecified_gender_profiles(
    p_governorate TEXT DEFAULT 'karbala'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH raw_unspecified AS (
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
            ) AS workplace,
            MAX(l.login_at) AS last_login_at
        FROM profiles p
        LEFT JOIN login_logs l ON p.id = l.user_id
        WHERE (p_governorate IS NULL OR p.governorate = p_governorate)
          AND (p.gender IS NULL OR p.gender = 'unspecified' OR TRIM(p.gender) = '')
        GROUP BY p.id, p.full_name, p.dept_text, p.section_text
        ORDER BY p.dept_text ASC NULLS LAST, p.full_name ASC
    )
    SELECT jsonb_build_object(
        'total_count', (SELECT COUNT(*) FROM raw_unspecified),
        'profiles', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'workplace', workplace,
                    'last_login_at', last_login_at
                )
            )
            FROM raw_unspecified
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
