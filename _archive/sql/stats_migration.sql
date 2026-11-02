-- 1. Add columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. Create RPC for statistics
CREATE OR REPLACE FUNCTION get_admin_stats_v1(p_governorate TEXT DEFAULT 'karbala')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'gender_dist', (
            SELECT jsonb_object_agg(COALESCE(gender, 'unspecified'), count)
            FROM (
                SELECT gender, count(*) as count
                FROM profiles
                WHERE governorate = p_governorate
                GROUP BY gender
            ) g
        ),
        'birth_year_dist', (
            SELECT jsonb_object_agg(birth_year, count)
            FROM (
                SELECT EXTRACT(YEAR FROM birth_date)::TEXT as birth_year, count(*) as count
                FROM profiles
                WHERE governorate = p_governorate AND birth_date IS NOT NULL
                GROUP BY birth_year
                ORDER BY birth_year
            ) b
        ),
        'appointment_year_dist', (
            SELECT jsonb_object_agg(app_year, count)
            FROM (
                SELECT EXTRACT(YEAR FROM (appointment_date::date))::TEXT as app_year, count(*) as count
                FROM profiles
                WHERE governorate = p_governorate AND appointment_date IS NOT NULL AND appointment_date ~ '^\d{4}-\d{2}-\d{2}$'
                GROUP BY app_year
                ORDER BY app_year
            ) a
        ),
        'login_activity', (
            SELECT jsonb_agg(d)
            FROM (
                SELECT 
                    TO_CHAR(created_at, 'YYYY-MM-DD') as date,
                    count(*) as count
                FROM login_logs
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY date
                ORDER BY date
            ) d
        )
    ) INTO result;
    
    RETURN result;
END;
$$;
