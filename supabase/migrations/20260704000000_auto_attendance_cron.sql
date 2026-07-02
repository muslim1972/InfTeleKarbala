-- Migration to add auto check-in/out fields and logic

-- 1. Add columns to attendance_records
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS is_auto_check_in BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_auto_check_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 2. Create the function to process auto attendance
CREATE OR REPLACE FUNCTION public.process_daily_attendance()
RETURNS void AS $$
DECLARE
    emp_rec RECORD;
    target_date DATE;
    expected_in TIMESTAMP WITH TIME ZONE;
    expected_out TIMESTAMP WITH TIME ZONE;
    existing_record RECORD;
    i INT;
BEGIN
    -- Loop through all active employees who have a shift schedule
    FOR emp_rec IN 
        SELECT wle.employee_id, wle.shift_start, wle.shift_end, wle.location_id
        FROM public.work_location_employees wle
        WHERE wle.shift_start IS NOT NULL AND wle.shift_end IS NOT NULL
    LOOP
        -- Check both yesterday and today to handle crossing midnight shifts
        FOR i IN 0..1 LOOP
            target_date := CURRENT_DATE - (1 - i) * INTERVAL '1 day'; -- checks yesterday (0) and today (1)
            
            -- Calculate expected shift times
            expected_in := (target_date || ' ' || emp_rec.shift_start)::TIMESTAMP WITH TIME ZONE;
            
            IF emp_rec.shift_start < emp_rec.shift_end THEN
                expected_out := (target_date || ' ' || emp_rec.shift_end)::TIMESTAMP WITH TIME ZONE;
            ELSE
                -- Night shift crosses midnight
                expected_out := (target_date + INTERVAL '1 day' || ' ' || emp_rec.shift_end)::TIMESTAMP WITH TIME ZONE;
            END IF;

            -- Only process if the shift has actually ended, and it ended within the last 24 hours
            IF NOW() >= expected_out AND NOW() < (expected_out + INTERVAL '24 hours') THEN
                
                -- Check if there is an existing record for this shift
                SELECT * INTO existing_record 
                FROM public.attendance_records
                WHERE employee_id = emp_rec.employee_id
                  AND check_in >= (expected_in - INTERVAL '6 hours')
                  AND check_in <= (expected_out)
                ORDER BY check_in DESC
                LIMIT 1;

                IF FOUND THEN
                    -- If record exists but no check out
                    IF existing_record.check_out IS NULL THEN
                        UPDATE public.attendance_records
                        SET check_out = expected_out,
                            is_auto_check_out = true
                        WHERE id = existing_record.id;
                    END IF;
                ELSE
                    -- No record exists -> auto create full record (Absent)
                    INSERT INTO public.attendance_records (
                        employee_id,
                        department_id,
                        check_in,
                        check_out,
                        status,
                        is_auto_check_in,
                        is_auto_check_out
                    )
                    SELECT 
                        emp_rec.employee_id,
                        p.department_id,
                        expected_in,
                        expected_out,
                        'absent',
                        true,
                        true
                    FROM public.profiles p
                    WHERE p.id = emp_rec.employee_id;
                END IF;

            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
