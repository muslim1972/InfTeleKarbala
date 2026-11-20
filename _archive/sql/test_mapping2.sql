BEGIN;

CREATE TEMP TABLE temp_hierarchy_updates AS
SELECT 
    id,
    full_name,
    dept_text AS old_dept,
    section_text AS old_sec,
    -- Determine new_dept
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

        -- Main Divisions directly under administration -> 'كربلاء'
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
             OR section_text ILIKE '%دفاع مدني%' OR section_text ILIKE '%نقليات%' 
             OR section_text ILIKE '%ديون%' THEN 'قسم المالي والاداري'

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
    END AS new_sec
FROM profiles
WHERE governorate = 'karbala' AND (is_retired IS FALSE OR is_retired IS NULL);

-- Check unmapped sections
SELECT old_dept, old_sec, new_dept, new_sec, count(*) as c
FROM temp_hierarchy_updates
WHERE new_sec IS NULL AND old_sec IS NOT NULL AND old_sec != ''
GROUP BY old_dept, old_sec, new_dept, new_sec;

ROLLBACK;