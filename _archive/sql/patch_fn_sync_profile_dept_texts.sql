CREATE OR REPLACE FUNCTION public.fn_sync_profile_dept_texts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_dept_level int;
    v_dept_name text;
    v_parent_id uuid;
    v_parent_level int;
    v_parent_name text;
    v_grandparent_id uuid;
    v_grandparent_name text;
BEGIN
    -- If department_id is null, do not overwrite manual legacy texts
    IF NEW.department_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch current department info
    SELECT level, name, parent_id
    INTO v_dept_level, v_dept_name, v_parent_id
    FROM public.departments
    WHERE id = NEW.department_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Case 1: Assigned to a Section under Department (Level 4, e.g. شعبة تابعة لقسم)
    IF v_dept_level = 4 THEN
        NEW.section_text := v_dept_name;
        NEW.unit_text := NULL;

        -- Fetch Parent (Level 3 - Department / قسم)
        IF v_parent_id IS NOT NULL THEN
            SELECT name, parent_id INTO v_parent_name, v_grandparent_id
            FROM public.departments
            WHERE id = v_parent_id;

            IF FOUND THEN
                NEW.dept_text := v_parent_name;
            END IF;
        END IF;

    -- Case 2: Level 3 (Departments, Independent Sections, or External Complexes)
    ELSIF v_dept_level = 3 THEN
        -- Independent sections (شعبة القدرة، شعبة المباني، الشعبة القانونية، إلخ) أو المجمعات
        IF v_dept_name LIKE 'شعبة%' OR v_dept_name LIKE 'شعبه%' OR v_dept_name LIKE 'الشعبة%' OR v_dept_name LIKE 'مجمع%' THEN
            NEW.dept_text := 'مديرية الاتصالات';
            NEW.section_text := v_dept_name;
            NEW.unit_text := NULL;
        ELSE
            -- قسم رئيسي فعلي (قسم المالي والاداري، قسم التراسل، قسم الشبكات، إلخ)
            NEW.dept_text := v_dept_name;
            NEW.section_text := '';
            NEW.unit_text := NULL;
        END IF;

    -- Case 3: Assigned to a Unit (Level 5, e.g. وحدة البيانات)
    ELSIF v_dept_level = 5 THEN
        NEW.unit_text := v_dept_name;

        IF v_parent_id IS NOT NULL THEN
            SELECT name, parent_id INTO v_parent_name, v_grandparent_id
            FROM public.departments
            WHERE id = v_parent_id;

            IF FOUND THEN
                NEW.section_text := v_parent_name;

                IF v_grandparent_id IS NOT NULL THEN
                    SELECT name INTO v_grandparent_name
                    FROM public.departments
                    WHERE id = v_grandparent_id;

                    IF FOUND THEN
                        NEW.dept_text := v_grandparent_name;
                    END IF;
                END IF;
            END IF;
        END IF;

    -- Case 4: Level 1 or 2 (Directorate / Senior Admin)
    ELSIF v_dept_level <= 2 THEN
        NEW.dept_text := v_dept_name;
        NEW.section_text := '';
        NEW.unit_text := '';
    END IF;

    RETURN NEW;
END;
$function$;
