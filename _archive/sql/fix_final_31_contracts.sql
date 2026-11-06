BEGIN;

-- 1. جلنار زهير سالم (وحدة البيانات تحت شعبة تناقل البيانات IP تحت قسم التراسل)
UPDATE profiles
SET department_id = '971279d5-f891-4446-af9f-24a89e37eb56', -- وحدة البيانات
    dept_text = 'قسم التراسل',
    section_text = 'شعبة تناقل البيانات IP',
    unit_text = 'وحدة البيانات',
    updated_at = NOW()
WHERE job_number = '99990005';

-- موقع بصمة جلنار: شعبة تناقل البيانات IP
DELETE FROM work_location_employees WHERE employee_id IN (SELECT id FROM profiles WHERE job_number = '99990005');
INSERT INTO work_location_employees (location_id, employee_id)
SELECT 'b80b5e05-1d78-4080-82c8-4bc172ed78b1', id -- شعبة تناقل البيانات IP/كربلاء
FROM profiles WHERE job_number = '99990005';


-- 2. الشعب المستقلة (قسمها: مديرية الاتصالات، شعبتها: اسم الشعبة، وحدتها: null)
-- شعبة القدرة (اكرم محمد ضاحي)
UPDATE profiles
SET department_id = '44444444-8888-8888-8888-888888888888',
    dept_text = 'مديرية الاتصالات',
    section_text = 'شعبة القدرة',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990002';

-- شعبة المباني (حسين عبد عبد الرضا، نغم عبد الرزاق)
UPDATE profiles
SET department_id = '44444444-7777-7777-7777-777777777777',
    dept_text = 'مديرية الاتصالات',
    section_text = 'شعبة المباني',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990006', '99990025');

-- الشعبة القانونية (حميد رحيم سوادي)
UPDATE profiles
SET department_id = '44444444-2222-2222-2222-222222222222',
    dept_text = 'مديرية الاتصالات',
    section_text = 'الشعبة القانونية',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990008';

-- شعبة العلاقات والاعلام (زين العابدين فاضل، ساره ابراهيم)
UPDATE profiles
SET department_id = '44444444-6666-6666-6666-666666666666',
    dept_text = 'مديرية الاتصالات',
    section_text = 'شعبة العلاقات والاعلام',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990012', '99990013');

-- شعبة GIS (عذراء احمد نجم)
UPDATE profiles
SET department_id = '44444444-5555-5555-5555-555555555555',
    dept_text = 'مديرية الاتصالات',
    section_text = 'شعبة GIS',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990016';

-- شعبة التخطيط والمتابعة (علياء محمد شهاب، نور كريم عبد عون)
UPDATE profiles
SET department_id = '44444444-3333-3333-3333-333333333333',
    dept_text = 'مديرية الاتصالات',
    section_text = 'شعبة التخطيط والمتابعة',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990017', '99990026');


-- 3. المجمعات الخارجية (قسمها: مديرية الاتصالات، شعبتها: اسم المجمع، وحدتها: null)
-- مجمع الهندية (اروى هاشم، حسين علي عبود، فاطمه مجيد، فراس وليد)
UPDATE profiles
SET department_id = '55555555-2222-2222-2222-222222222222',
    dept_text = 'مديرية الاتصالات',
    section_text = 'مجمع اتصالات قضاء الهندية',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990001', '99990007', '99990018', '99990019');

-- مجمع عين التمر (جاسم عدنان جاسم، محمد علي عبيد)
UPDATE profiles
SET department_id = '55555555-8888-8888-8888-888888888888',
    dept_text = 'مديرية الاتصالات',
    section_text = 'مجمع اتصالات عين التمر',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990004', '99990023');

-- مجمع الحر (خديجة علي صاحب)
UPDATE profiles
SET department_id = '55555555-3333-3333-3333-333333333333',
    dept_text = 'مديرية الاتصالات',
    section_text = 'مجمع اتصالات الحر',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990010';

-- مجمع الخيرات (عبد الله ثائر، هاجر ناصر)
UPDATE profiles
SET department_id = '55555555-6666-6666-6666-666666666666',
    dept_text = 'مديرية الاتصالات',
    section_text = 'مجمع اتصالات الخيرات',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990015', '99990027');

-- مجمع سيد الشهداء (هدى علي حسين)
UPDATE profiles
SET department_id = '55555555-1111-1111-1111-111111111111',
    dept_text = 'مديرية الاتصالات',
    section_text = 'مجمع اتصالات سيد الشهداء (ع)',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990028';


-- 4. الشعب التابعة لأقسام
-- الموارد البشرية (انوار، حوراء، عذراء رعد، مي عبد الكاظم، محمد ابراهيم، سرى عبد الامير)
UPDATE profiles
SET department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
    dept_text = 'قسم المالي والاداري',
    section_text = 'شعبة ادارة الموارد البشرية',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990003', '99990029', '99990030', '99990031', '99990020', '99990014');

-- المالية (حنين محمد صالح)
UPDATE profiles
SET department_id = '1b36ac3c-9119-4c89-9429-78b28b37cfcf',
    dept_text = 'قسم المالي والاداري',
    section_text = 'شعبة الشؤون المالية',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990009';

-- المخازن (زيد علاء، محمد خضير)
UPDATE profiles
SET department_id = '6cfc9f5e-8f21-4aea-b5a7-dd07d6596783',
    dept_text = 'قسم المالي والاداري',
    section_text = 'شعبة المخازن',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number IN ('99990011', '99990021');

-- الخدمات الإدارية (محمد عبد الله)
UPDATE profiles
SET department_id = '1d12ddd7-ec53-4295-a41d-4e8c9cef60c3',
    dept_text = 'قسم المالي والاداري',
    section_text = 'شعبة الخدمات الادارية والنقليات',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990022';

-- التسويق والمتابعة (محمد كامل عبد)
UPDATE profiles
SET department_id = '3d03eb6a-1687-4002-9821-57678a760559',
    dept_text = 'قسم تجهيز خدمات المعلوماتية',
    section_text = 'شعبة التسويق والمتابعة',
    unit_text = NULL,
    updated_at = NOW()
WHERE job_number = '99990024';

COMMIT;
