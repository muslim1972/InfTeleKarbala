-- ====================================================================
-- تصحيح التشكيل الإداري ومواقع البصمة لموظفي العقود الـ 31 في كربلاء
-- ====================================================================

DO $$
DECLARE
    v_profile_id uuid;
    v_dept_id uuid;
    v_loc_id uuid;
BEGIN

    -- 1. اروى هاشم علي (99990001) -> مجمع اتصالات الهندية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990001';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-2222-2222-2222-222222222222',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الهندية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '61880567-2b72-4878-b394-6bc42d09d161')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 2. اكرم محمد ضاحي (99990002) -> شعبة القدرة
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990002';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-8888-8888-8888-888888888888',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة القدرة',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'fd6c2c10-6c24-401d-9ca7-bc8a8888a2f7')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 3. انوار محمد حسين (99990003) -> شعبة ادارة الموارد البشرية (قسم المالي والاداري)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990003';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 4. جاسم عدنان جاسم (99990004) -> مجمع عين التمر
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990004';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-8888-8888-8888-888888888888',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات عين التمر',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'e13ad979-20d5-40a0-9a72-c518dcd373db')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 5. جلنار زهير سالم (99990005) -> وحدة البيانات (شعبة تناقل البيانات IP - قسم التراسل)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990005';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '971279d5-f891-4446-af9f-24a89e37eb56',
            dept_text = 'قسم التراسل',
            section_text = 'شعبة تناقل البيانات IP',
            unit_text = 'وحدة البيانات'
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'b80b5e05-1d78-4080-82c8-4bc172ed78b1')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 6. حسين عبد عبد الرضا (99990006) -> شعبة المباني
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990006';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-7777-7777-7777-777777777777',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة المباني',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'cf4cd9a0-8be7-4f1f-8b58-fe30e6b35bcc')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 7. حسين علي عبود (99990007) -> مجمع اتصالات الهندية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990007';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-2222-2222-2222-222222222222',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الهندية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '61880567-2b72-4878-b394-6bc42d09d161')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 8. حميد رحيم سوادي (99990008) -> الشعبة القانونية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990008';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-2222-2222-2222-222222222222',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'الشعبة القانونية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '118ea697-58cc-440d-82c7-cdf4cf5d51db')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 9. حنين محمد صالح (99990009) -> شعبة الشؤون المالية (قسم المالي والاداري)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990009';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '1b36ac3c-9119-4c89-9429-78b28b37cfcf',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة الشؤون المالية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '0c339fc2-8412-4497-bd82-b8f1b9803816')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 10. حوراء رياض جواد (99990029) -> شعبة الموارد البشرية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990029';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 11. خديجة علي صاحب (99990010) -> مجمع اتصالات الحر (ع)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990010';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-3333-3333-3333-333333333333',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الحر (ع)',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'b688452c-0d37-4a26-a503-f6670e37db59')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 12. زيد علاء عبد علي (99990011) -> شعبة المخازن
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990011';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '6cfc9f5e-8f21-4aea-b5a7-dd07d6596783',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة المخازن',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '0da575ea-300b-4b24-823d-5478d9ab5f56')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 13. زين العابدين فاضل كاظم (99990012) -> شعبة العلاقات والاعلام
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990012';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-6666-6666-6666-666666666666',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة العلاقات والاعلام',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'e7b4f0bf-4e3b-4474-9352-bb2bac7eb4b2')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 14. ساره ابراهيم محمد (99990013) -> شعبة العلاقات والاعلام
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990013';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-6666-6666-6666-666666666666',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة العلاقات والاعلام',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'e7b4f0bf-4e3b-4474-9352-bb2bac7eb4b2')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 15. سرى عبد الامير حسن (99990014) -> شعبة الموارد البشرية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990014';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 16. عبد الله ثائر فلاح (99990015) -> مجمع اتصالات الخيرات
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990015';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-6666-6666-6666-666666666666',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الخيرات',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '7cebb602-5601-4210-a837-826e10f5a29a')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 17. عذراء احمد نجم (99990016) -> شعبة GIS
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990016';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-5555-5555-5555-555555555555',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة GIS',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '716aba83-9558-4a2a-9b72-0fea09f72178')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 18. عذراء رعد حميد (99990030) -> شعبة الموارد البشرية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990030';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 19. علياء محمد شهاب (99990017) -> شعبة التخطيط والمتابعة
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990017';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-3333-3333-3333-333333333333',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة التخطيط والمتابعة',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '95a7910f-6345-491f-9e2a-71ed4a44e20b')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 20. فاطمه مجيد حميد (99990018) -> مجمع اتصالات الهندية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990018';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-2222-2222-2222-222222222222',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الهندية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '61880567-2b72-4878-b394-6bc42d09d161')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 21. فراس وليد احمد (99990019) -> مجمع اتصالات الهندية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990019';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-2222-2222-2222-222222222222',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الهندية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '61880567-2b72-4878-b394-6bc42d09d161')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 22. محمد ابراهيم محمد (99990020) -> شعبة الموارد البشرية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990020';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 23. محمد خضير محيسن (99990021) -> شعبة المخازن
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990021';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '6cfc9f5e-8f21-4aea-b5a7-dd07d6596783',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة المخازن',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '0da575ea-300b-4b24-823d-5478d9ab5f56')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 24. محمد عبد الله حمزه (99990022) -> شعبة الخدمات الادارية والنقليات
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990022';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '1d12ddd7-ec53-4295-a41d-4e8c9cef60c3',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة الخدمات الادارية والنقليات',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a0d0fa9f-e48c-4e3e-82e2-3fe413986148')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 25. محمد علي عبيد (99990023) -> مجمع عين التمر
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990023';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-8888-8888-8888-888888888888',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات عين التمر',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'e13ad979-20d5-40a0-9a72-c518dcd373db')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 26. محمد كامل عبد (99990024) -> شعبة التسويق والمتابعة (قسم تجهيز خدمات المعلوماتية)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990024';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '3d03eb6a-1687-4002-9821-57678a760559',
            dept_text = 'قسم تجهيز خدمات المعلوماتية',
            section_text = 'شعبة التسويق والمتابعة',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '5c904eec-7aa1-4e43-ae2d-0219d3926afb')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 27. مي عبد الكاظم عوده (99990031) -> شعبة الموارد البشرية
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990031';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '8669731c-bca9-46c5-9def-710e71c6f267',
            dept_text = 'قسم المالي والاداري',
            section_text = 'شعبة ادارة الموارد البشرية',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'a6e4e3a1-704a-424e-a6e1-2d254ce96963')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 28. نغم عبد الرزاق عبد النبي (99990025) -> شعبة المباني
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990025';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-7777-7777-7777-777777777777',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة المباني',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'cf4cd9a0-8be7-4f1f-8b58-fe30e6b35bcc')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 29. نور كريم عبد عون (99990026) -> شعبة التخطيط والمتابعة
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990026';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '44444444-3333-3333-3333-333333333333',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'شعبة التخطيط والمتابعة',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '95a7910f-6345-491f-9e2a-71ed4a44e20b')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 30. هاجر ناصر حسين (99990027) -> مجمع اتصالات الخيرات
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990027';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-6666-6666-6666-666666666666',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات الخيرات',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, '7cebb602-5601-4210-a837-826e10f5a29a')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

    -- 31. هدى علي حسين (99990028) -> مجمع اتصالات سيد الشهداء (ع)
    SELECT id INTO v_profile_id FROM profiles WHERE job_number = '99990028';
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles SET 
            department_id = '55555555-1111-1111-1111-111111111111',
            dept_text = 'مكتب معاون مدير المديرية',
            section_text = 'مجمع اتصالات سيد الشهداء (ع)',
            unit_text = NULL
        WHERE id = v_profile_id;
        
        INSERT INTO work_location_employees (employee_id, location_id)
        VALUES (v_profile_id, 'bcb41dbe-9317-4a6e-b5a7-641fd88df4f3')
        ON CONFLICT (employee_id) DO UPDATE SET location_id = EXCLUDED.location_id;
    END IF;

END $$;
