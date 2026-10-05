DO $do
DECLARE
  v_aseel_id uuid := 'ac925b42-494b-4a55-a0bc-979f4007b8b2';
  v_haidar_id uuid := 'aa7b0b6e-efbd-44cc-924a-251f041ff347';
  v_dept record;
  v_chain jsonb := '[]'::jsonb;
  v_supervisor_id uuid;
  v_current_dept_id uuid;
BEGIN
  -- Simulate fetchManager logic from frontend
  SELECT department_id INTO v_current_dept_id FROM profiles WHERE id = v_aseel_id;
  
  LOOP
    IF v_current_dept_id IS NULL THEN
      EXIT;
    END IF;
    
    SELECT * INTO v_dept FROM departments WHERE id = v_current_dept_id;
    
    IF v_dept.manager_id IS NOT NULL AND v_dept.manager_id != v_aseel_id THEN
      v_supervisor_id := v_dept.manager_id;
      EXIT;
    END IF;
    
    IF v_dept.level <= 3 THEN
      EXIT;
    END IF;
    
    v_current_dept_id := v_dept.parent_id;
  END LOOP;

  IF v_supervisor_id = v_haidar_id THEN
    RAISE NOTICE 'SUCCESS: Aseel request routes to Haidar!';
  ELSE
    RAISE NOTICE 'FAIL: Routed to %', v_supervisor_id;
  END IF;
END $do;
