-- 1. تصحيح ارتباط شعبة ادارة مكتب المدير لتتبع مدير المديرية مباشرة
UPDATE departments
SET parent_id = '11111111-1111-1111-1111-111111111111'
WHERE id = '44444444-1111-1111-1111-111111111111';

-- 2. استحداث موقع البصمة: مدير المديرية/كربلاء
DO $$
DECLARE
    v_loc_id uuid;
BEGIN
    SELECT id INTO v_loc_id FROM work_locations WHERE name = 'مدير المديرية/كربلاء';
    IF v_loc_id IS NULL THEN
        INSERT INTO work_locations (id, name, latitude, longitude, radius_meters, governorate, is_active)
        VALUES (
            gen_random_uuid(),
            'مدير المديرية/كربلاء',
            32.612050,
            44.034337,
            90,
            'karbala',
            true
        ) RETURNING id INTO v_loc_id;
    END IF;

    -- 3. ربط الدكتور علي عباس جاسم الصباغ بهذا الموقع
    DELETE FROM work_location_employees
    WHERE employee_id = (SELECT id FROM profiles WHERE job_number = '102484102');

    INSERT INTO work_location_employees (employee_id, location_id)
    SELECT p.id, v_loc_id
    FROM profiles p
    WHERE p.job_number = '102484102';
END $$;

-- 4. ضبط حقول الـ HR في profiles للدكتور علي عباس جاسم
UPDATE profiles
SET dept_text = 'مدير المديرية',
    section_text = NULL,
    unit_text = NULL,
    department_id = '11111111-1111-1111-1111-111111111111'
WHERE job_number = '102484102';
