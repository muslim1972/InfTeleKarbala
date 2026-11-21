DO $do_block$
DECLARE
    v_test_emp_id uuid;
    v_orig_dept_id uuid;
    v_dept1 uuid;
    v_dept2 uuid;
    v_dept1_mgr uuid;
    v_dept2_mgr uuid;
    v_check_dept uuid;
BEGIN
    SELECT id, department_id INTO v_test_emp_id, v_orig_dept_id 
    FROM profiles 
    WHERE governorate = 'karbala' AND role = 'user' AND department_id IS NOT NULL 
    LIMIT 1;

    SELECT id INTO v_dept1 FROM departments WHERE governorate = 'karbala' LIMIT 1;
    SELECT id INTO v_dept2 FROM departments WHERE governorate = 'karbala' AND id <> v_dept1 LIMIT 1;

    RAISE NOTICE 'Test employee: %, Original Dept: %', v_test_emp_id, v_orig_dept_id;

    -- Update dept 1
    UPDATE departments SET manager_id = v_test_emp_id WHERE id = v_dept1;
    -- Update dept 2
    UPDATE departments SET manager_id = v_test_emp_id WHERE id = v_dept2;

    -- Verify manager on both
    SELECT manager_id INTO v_dept1_mgr FROM departments WHERE id = v_dept1;
    SELECT manager_id INTO v_dept2_mgr FROM departments WHERE id = v_dept2;

    -- Verify profile department is untouched
    SELECT department_id INTO v_check_dept FROM profiles WHERE id = v_test_emp_id;

    RAISE NOTICE 'Dept1 Manager: %, Dept2 Manager: %', v_dept1_mgr, v_dept2_mgr;
    RAISE NOTICE 'Profile Department: % (Expected original: %)', v_check_dept, v_orig_dept_id;

    IF v_dept1_mgr = v_test_emp_id AND v_dept2_mgr = v_test_emp_id AND (v_check_dept IS NOT DISTINCT FROM v_orig_dept_id) THEN
        RAISE NOTICE 'SUCCESS: Multi-responsibility and profile decoupling verified!';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Manager assignment did not match expectation';
    END IF;

    -- Rollback
    RAISE EXCEPTION 'ROLLBACK TEST TRANSACTION';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM = 'ROLLBACK TEST TRANSACTION' THEN
            RAISE NOTICE 'Transaction safely rolled back after successful verification.';
        ELSE
            RAISE;
        END IF;
END $do_block$;
