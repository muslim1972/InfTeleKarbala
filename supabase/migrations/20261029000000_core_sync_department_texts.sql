-- ==============================================================================
-- B.R.I.C.K Kernel: BE-CORE-06 (Departments & Governorates) / BE-HR-01
-- Migration: 20261029000000_core_sync_department_texts.sql
-- Description: Deterministic synchronization trigger to ensure profiles.section_text,
--              dept_text, and unit_text are always kept synchronized with relational
--              hierarchy (department_id) across all transfer actions.
-- ==============================================================================

-- 1. Function to synchronize profile dept & section texts from departments
CREATE OR REPLACE FUNCTION public.fn_sync_profile_dept_texts()
RETURNS TRIGGER AS $$
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

    -- Case 1: Assigned to a Section / Center / Muraqaba (Level 4, e.g. شعبة / مجمع)
    IF v_dept_level = 4 THEN
        NEW.section_text := v_dept_name;
        
        -- Fetch Parent (Level 3 - Department / قسم)
        IF v_parent_id IS NOT NULL THEN
            SELECT name, parent_id INTO v_parent_name, v_grandparent_id
            FROM public.departments
            WHERE id = v_parent_id;
            
            IF FOUND THEN
                NEW.dept_text := v_parent_name;
            END IF;
        END IF;

    -- Case 2: Assigned directly to a Department (Level 3, e.g. قسم)
    ELSIF v_dept_level = 3 THEN
        NEW.dept_text := v_dept_name;
        NEW.section_text := '';

    -- Case 3: Assigned to a Unit (Level 5, e.g. وحدة)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create BEFORE Trigger on public.profiles
DROP TRIGGER IF EXISTS trg_sync_profile_dept_texts ON public.profiles;

CREATE TRIGGER trg_sync_profile_dept_texts
BEFORE INSERT OR UPDATE OF department_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_profile_dept_texts();

-- 3. One-time data correction for all active profiles with department_id,
--    ensuring Murtadha Ali Hadi (103131418) and all other transferred employees
--    are fully synchronized immediately.
DO $$
DECLARE
    r RECORD;
    v_level int;
    v_name text;
    v_parent_id uuid;
    v_parent_name text;
BEGIN
    FOR r IN SELECT id, department_id FROM public.profiles WHERE department_id IS NOT NULL LOOP
        SELECT level, name, parent_id INTO v_level, v_name, v_parent_id
        FROM public.departments
        WHERE id = r.department_id;

        IF FOUND THEN
            IF v_level = 4 THEN
                SELECT name INTO v_parent_name FROM public.departments WHERE id = v_parent_id;
                UPDATE public.profiles
                SET section_text = v_name,
                    dept_text = COALESCE(v_parent_name, dept_text)
                WHERE id = r.id;
            ELSIF v_level = 3 THEN
                UPDATE public.profiles
                SET dept_text = v_name
                WHERE id = r.id;
            END IF;
        END IF;
    END LOOP;
END $$;
