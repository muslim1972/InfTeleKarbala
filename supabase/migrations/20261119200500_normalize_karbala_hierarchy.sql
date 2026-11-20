-- Migration: 20261119200500_normalize_karbala_hierarchy.sql
-- Goal: Normalize administrative hierarchy (dept_text, section_text, unit_text, department_id) for Karbala staff
--       and update get_active_visitors_by_range RPC to produce clean formatted workplace hierarchy.

DO $$
BEGIN
    -- 1. Create temporary normalized table
    CREATE TEMP TABLE temp_hierarchy_map AS
    SELECT 
        id,
        -- Calculate new_dept
        CASE 
            -- Complexes -> 'كربلاء'
            WHEN section_text ILIKE '%هندية%' OR dept_text ILIKE '%هندية%' THEN 'كربلاء'
            WHEN section_text ILIKE '%حسينية%' OR dept_text ILIKE '%حسينية%' THEN 'كربلاء'
            WHEN section_text ILIKE '%حر%' OR dept_text ILIKE '%حر%' THEN 'كربلاء'
            WHEN section_text ILIKE '%غدير%' OR dept_text ILIKE '%غدير%' THEN 'كربلاء'
            WHEN section_text ILIKE '%شهداء%' OR dept_text ILIKE '%شهداء%' THEN 'كربلاء'
            WHEN section_text ILIKE '%جدول%' OR dept_text ILIKE '%جدول%' THEN 'كربلاء'
            WHEN section_text ILIKE '%خيرات%' OR dept_text ILIKE '%خيرات%' THEN 'كربلاء'
            WHEN section_text ILIKE '%تمر%' OR dept_text ILIKE '%تمر%' THEN 'كربلاء'

            -- Main Divisions under Administration -> 'كربلاء'
            WHEN section_text ILIKE '%قانونية%' OR dept_text ILIKE '%قانونية%' THEN 'كربلاء'
            WHEN section_text ILIKE '%قدرة%' OR dept_text ILIKE '%قدرة%' THEN 'كربلاء'
            WHEN section_text ILIKE '%GIS%' OR dept_text ILIKE '%GIS%' THEN 'كربلاء'
            WHEN section_text ILIKE '%تدقيق%' OR dept_text ILIKE '%تدقيق%' THEN 'كربلاء'
            WHEN section_text ILIKE '%تخطيط%' OR dept_text ILIKE '%تخطيط%' THEN 'كربلاء'
            WHEN section_text ILIKE '%اعلام%' OR dept_text ILIKE '%اعلام%' OR section_text ILIKE '%علاقات%' THEN 'كربلاء'
            WHEN section_text ILIKE '%مباني%' OR dept_text ILIKE '%مباني%' THEN 'كربلاء'
            WHEN section_text ILIKE '%مكتب المدير%' OR dept_text ILIKE '%مكتب المدير%' THEN 'كربلاء'
            WHEN section_text ILIKE '%معاون%' OR dept_text ILIKE '%معاون%' THEN 'كربلاء'

            -- Department: قسم تجهيز خدمات المعلوماتية
            WHEN dept_text ILIKE '%تجهيز%' OR dept_text ILIKE '%معلوماتية%' 
                 OR section_text ILIKE '%تجهيز الخدمة%' OR section_text ILIKE '%تسويق%' THEN 'قسم تجهيز خدمات المعلوماتية'

            -- Department: قسم الشبكات
            WHEN dept_text ILIKE '%شبكات%' 
                 OR section_text ILIKE '%FTTX%' OR section_text ILIKE '%fttx%' 
                 OR section_text ILIKE '%نحاسية%' OR section_text ILIKE '%بدالات%' 
                 OR section_text ILIKE '%تصاميم%' THEN 'قسم الشبكات'

            -- Department: قسم التراسل
            WHEN dept_text ILIKE '%تراسل%' 
                 OR section_text ILIKE '%لاسلكية%' OR section_text ILIKE '%ضوئية%' 
                 OR section_text ILIKE '%تناقل%' OR section_text ILIKE '%IP%' THEN 'قسم التراسل'

            -- Department: قسم المالي والاداري
            WHEN dept_text ILIKE '%مالي%' OR dept_text ILIKE '%اداري%' 
                 OR section_text ILIKE '%موارد%' OR section_text ILIKE '%شؤون مالية%' 
                 OR section_text ILIKE '%مالية%' OR section_text ILIKE '%مخازن%' 
                 OR section_text ILIKE '%دفاع%' OR section_text ILIKE '%نقليات%' 
                 OR section_text ILIKE '%ديون%' THEN 'قسم المالي والاداري'

            ELSE 'كربلاء'
        END AS target_dept,

        -- Calculate new_sec
        CASE 
            -- Complexes
            WHEN section_text ILIKE '%هندية%' OR dept_text ILIKE '%هندية%' THEN 'مجمع اتصالات الهندية'
            WHEN section_text ILIKE '%حسينية%' OR dept_text ILIKE '%حسينية%' THEN 'مجمع اتصالات الحسينية'
            WHEN section_text ILIKE '%حر%' OR dept_text ILIKE '%حر%' THEN 'مجمع اتصالات الحر (ع)'
            WHEN section_text ILIKE '%غدير%' OR dept_text ILIKE '%غدير%' THEN 'مجمع اتصالات الغدير'
            WHEN section_text ILIKE '%شهداء%' OR dept_text ILIKE '%شهداء%' THEN 'مجمع اتصالات سيد الشهداء (ع)'
            WHEN section_text ILIKE '%جدول%' OR dept_text ILIKE '%جدول%' THEN 'مجمع اتصالات الجدول الغربي'
            WHEN section_text ILIKE '%خيرات%' OR dept_text ILIKE '%خيرات%' THEN 'مجمع اتصالات الخيرات'
            WHEN section_text ILIKE '%تمر%' OR dept_text ILIKE '%تمر%' THEN 'مجمع اتصالات عين التمر'

            -- Main Divisions under Administration
            WHEN section_text ILIKE '%قانونية%' OR dept_text ILIKE '%قانونية%' THEN 'الشعبة القانونية'
            WHEN section_text ILIKE '%قدرة%' OR dept_text ILIKE '%قدرة%' THEN 'شعبة القدرة'
            WHEN section_text ILIKE '%GIS%' OR dept_text ILIKE '%GIS%' THEN 'شعبة GIS'
            WHEN section_text ILIKE '%تدقيق%' OR dept_text ILIKE '%تدقيق%' THEN 'شعبة التدقيق والرقابة الداخلية'
            WHEN section_text ILIKE '%تخطيط%' OR dept_text ILIKE '%تخطيط%' THEN 'شعبة التخطيط والمتابعة'
            WHEN section_text ILIKE '%اعلام%' OR dept_text ILIKE '%اعلام%' OR section_text ILIKE '%علاقات%' THEN 'شعبة العلاقات والاعلام'
            WHEN section_text ILIKE '%مباني%' OR dept_text ILIKE '%مباني%' THEN 'شعبة المباني'
            WHEN section_text ILIKE '%مكتب المدير%' OR dept_text ILIKE '%مكتب المدير%' THEN 'شعبة ادارة مكتب المدير'
            WHEN section_text ILIKE '%معاون%' OR dept_text ILIKE '%معاون%' THEN 'مكتب معاون مدير المديرية'

            -- Sections under 'قسم المالي والاداري'
            WHEN section_text ILIKE '%موارد%' THEN 'شعبة ادارة الموارد البشرية'
            WHEN section_text ILIKE '%شؤون مالية%' OR section_text ILIKE '%مالية%' THEN 'شعبة الشؤون المالية'
            WHEN section_text ILIKE '%مخازن%' THEN 'شعبة المخازن'
            WHEN section_text ILIKE '%دفاع%' THEN 'شعبة الدفاع المدني'
            WHEN section_text ILIKE '%نقليات%' OR section_text ILIKE '%خدمات ادارية%' THEN 'شعبة الخدمات الادارية والنقليات'
            WHEN section_text ILIKE '%ديون%' THEN 'وحده تصفية الديون السابقه'

            -- Sections under 'قسم تجهيز خدمات المعلوماتية'
            WHEN section_text ILIKE '%تجهيز الخدمة%' THEN 'شعبة ادارة تجهيز الخدمة'
            WHEN section_text ILIKE '%تسويق%' THEN 'شعبة التسويق والمتابعة'

            -- Sections under 'قسم الشبكات'
            WHEN section_text ILIKE '%FTTX%' OR section_text ILIKE '%fttx%' THEN 'شعبة FTTX'
            WHEN section_text ILIKE '%بدالات%' OR section_text ILIKE '%نحاسية%' THEN 'شعبة البدالات والشبكة النحاسية'
            WHEN section_text ILIKE '%تصاميم%' THEN 'شعبة التصاميم'

            -- Sections under 'قسم التراسل'
            WHEN section_text ILIKE '%ضوئية%' OR section_text ILIKE '%سلكية%' THEN 'شعبة الاتصالات السلكية الضوئية'
            WHEN section_text ILIKE '%لاسلكية%' THEN 'شعبة الاتصالات اللاسلكية'
            WHEN section_text ILIKE '%تناقل%' OR section_text ILIKE '%IP%' THEN 'شعبة تناقل البيانات IP'

            ELSE NULL
        END AS target_sec
    FROM profiles
    WHERE governorate = 'karbala';

    -- 2. Execute update on profiles
    UPDATE profiles p
    SET 
        dept_text = m.target_dept,
        section_text = m.target_sec,
        department_id = COALESCE(
            (SELECT d.id FROM departments d WHERE d.name = m.target_sec LIMIT 1),
            (SELECT d.id FROM departments d WHERE d.name = m.target_dept LIMIT 1),
            p.department_id
        )
    FROM temp_hierarchy_map m
    WHERE p.id = m.id;

    DROP TABLE temp_hierarchy_map;
END $$;

-- 3. Upgrade get_active_visitors_by_range RPC
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
    v_total_staff INT;
    v_total_active INT;
    v_inactive_count INT;
    v_pwa_count INT;
    v_browser_count INT;
    v_visitors JSONB;
    v_inactive JSONB;
BEGIN
    -- Set timestamps for full days in Iraq timezone (UTC+3)
    v_start_ts := (p_start_date::text || ' 00:00:00+03')::TIMESTAMPTZ;
    v_end_ts := ((p_end_date + 1)::text || ' 00:00:00+03')::TIMESTAMPTZ;

    -- Active staff with standardized workplace hierarchy
    WITH active_staff AS (
        SELECT 
            p.id AS user_id,
            p.full_name,
            p.dept_text,
            p.section_text,
            p.unit_text,
            CASE 
                -- When dept_text is 'كربلاء' and there is a section
                WHEN p.dept_text = 'كربلاء' AND p.section_text IS NOT NULL AND TRIM(p.section_text) != '' THEN
                    'كربلاء / ' || TRIM(p.section_text) || 
                    CASE WHEN p.unit_text IS NOT NULL AND TRIM(p.unit_text) != '' THEN ' / ' || TRIM(p.unit_text) ELSE '' END
                
                -- When dept_text is a department and there is a section
                WHEN p.dept_text IS NOT NULL AND TRIM(p.dept_text) != '' AND p.section_text IS NOT NULL AND TRIM(p.section_text) != '' THEN
                    TRIM(p.dept_text) || ' / ' || TRIM(p.section_text) ||
                    CASE WHEN p.unit_text IS NOT NULL AND TRIM(p.unit_text) != '' THEN ' / ' || TRIM(p.unit_text) ELSE '' END
                
                -- When only dept_text exists
                WHEN p.dept_text IS NOT NULL AND TRIM(p.dept_text) != '' THEN
                    TRIM(p.dept_text)
                
                -- When only section_text exists
                WHEN p.section_text IS NOT NULL AND TRIM(p.section_text) != '' THEN
                    'كربلاء / ' || TRIM(p.section_text)
                
                ELSE 'مديرية اتصالات كربلاء'
            END AS workplace
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
            s.dept_text,
            s.section_text,
            s.unit_text,
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
            s.dept_text,
            s.section_text,
            s.unit_text,
            s.workplace,
            hl.last_seen_at,
            0 AS visit_count,
            false AS is_pwa
        FROM active_staff s
        LEFT JOIN period_logs pl ON s.user_id = pl.user_id
        LEFT JOIN historical_last_seen hl ON s.user_id = hl.user_id
        WHERE pl.user_id IS NULL
    )
    SELECT 
        (SELECT COUNT(*) FROM active_staff),
        (SELECT COUNT(*) FROM active_visitors),
        (SELECT COUNT(*) FROM inactive_staff),
        (SELECT COUNT(*) FROM active_visitors WHERE is_pwa = true),
        (SELECT COUNT(*) FROM active_visitors WHERE is_pwa = false),
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'dept_text', dept_text,
                    'section_text', section_text,
                    'unit_text', unit_text,
                    'workplace', workplace,
                    'last_login_at', last_login_at,
                    'visit_count', visit_count,
                    'is_pwa', is_pwa
                )
                ORDER BY last_login_at DESC
            )
            FROM active_visitors
        ), '[]'::jsonb),
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'full_name', full_name,
                    'dept_text', dept_text,
                    'section_text', section_text,
                    'unit_text', unit_text,
                    'workplace', workplace,
                    'last_seen_at', last_seen_at,
                    'visit_count', 0,
                    'is_pwa', false
                )
                ORDER BY last_seen_at DESC NULLS LAST
            )
            FROM inactive_staff
        ), '[]'::jsonb)
    INTO 
        v_total_staff,
        v_total_active,
        v_inactive_count,
        v_pwa_count,
        v_browser_count,
        v_visitors,
        v_inactive;

    RETURN jsonb_build_object(
        'total_staff', v_total_staff,
        'total_visitors', v_total_active,
        'inactive_count', v_inactive_count,
        'pwa_count', v_pwa_count,
        'browser_count', v_browser_count,
        'visitors', v_visitors,
        'inactive_users', v_inactive
    );
END;
$$;
