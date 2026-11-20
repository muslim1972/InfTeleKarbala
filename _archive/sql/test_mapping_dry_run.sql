BEGIN;

-- Helper temporary function or UPDATE with CASE
CREATE TEMP TABLE temp_hierarchy_updates AS
SELECT 
    id,
    full_name,
    dept_text AS old_dept,
    section_text AS old_sec,
    unit_text AS old_unit,
    department_id AS old_dept_id,
    -- Determine new_dept
    CASE 
        -- Main Departments
        WHEN (dept_text ILIKE '%مالي%' OR dept_text ILIKE '%اداري%' OR section_text ILIKE '%موارد بشرية%' OR section_text ILIKE '%شؤون مالية%' OR section_text ILIKE '%مخازن%' OR section_text ILIKE '%دفاع مدني%' OR section_text ILIKE '%خدمات ادارية%')
             AND (section_text NOT ILIKE '%مكتب المدير%') THEN 'قسم المالي والاداري'
        
        WHEN (dept_text ILIKE '%تجهيز%' OR dept_text ILIKE '%معلوماتية%' OR section_text ILIKE '%تجهيز الخدمة%' OR section_text ILIKE '%تسويق%') THEN 'قسم تجهيز خدمات المعلوماتية'
        
        WHEN (dept_text ILIKE '%شبكات%' OR section_text ILIKE '%FTTX%' OR section_text ILIKE '%نحاسية%' OR section_text ILIKE '%بدالات%' OR section_text ILIKE '%تصاميم%') THEN 'قسم الشبكات'
        
        WHEN (dept_text ILIKE '%تراسل%' OR section_text ILIKE '%لاسلكية%' OR section_text ILIKE '%ضوئية%' OR section_text ILIKE '%بيانات IP%') THEN 'قسم التراسل'

        -- Everything else (Main divisions and Complexes) -> 'كربلاء'
        ELSE 'كربلاء'
    END AS new_dept,

    -- Determine new_sec
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
        WHEN section_text ILIKE '%موارد بشرية%' THEN 'شعبة ادارة الموارد البشرية'
        WHEN section_text ILIKE '%شؤون مالية%' OR section_text ILIKE '%مالية%' THEN 'شعبة الشؤون المالية'
        WHEN section_text ILIKE '%مخازن%' THEN 'شعبة المخازن'
        WHEN section_text ILIKE '%دفاع مدني%' THEN 'شعبة الدفاع المدني'
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
        WHEN section_text ILIKE '%بيانات IP%' OR section_text ILIKE '%تناقل%' THEN 'شعبة تناقل البيانات IP'

        -- Fallback if section equals department or empty
        ELSE NULL
    END AS new_sec
FROM profiles
WHERE governorate = 'karbala' AND (is_retired IS FALSE OR is_retired IS NULL);

-- Show sample of 30 mapped rows
SELECT old_dept, old_sec, new_dept, new_sec, COUNT(*) as c
FROM temp_hierarchy_updates
GROUP BY old_dept, old_sec, new_dept, new_sec
ORDER BY c DESC
LIMIT 40;

ROLLBACK;