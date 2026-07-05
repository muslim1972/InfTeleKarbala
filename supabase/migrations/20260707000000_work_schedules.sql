-- =============================================
-- نظام جداول العمل (Work Schedules)
-- =============================================

-- 1. Create work_schedules table
CREATE TABLE IF NOT EXISTS public.work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'fixed' CHECK (type IN ('fixed', 'flexible')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create work_schedule_days table
CREATE TABLE IF NOT EXISTS public.work_schedule_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    is_rest_day BOOLEAN NOT NULL DEFAULT false,
    start_time TIME,
    end_time TIME,
    UNIQUE(schedule_id, day_of_week)
);

-- 3. Create public_holidays table
CREATE TABLE IF NOT EXISTS public.public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_schedule_id UUID REFERENCES public.work_schedules(id) ON DELETE SET NULL;

-- 5. Add columns to attendance_records for time leave and overtime
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS time_leave_out TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_leave_return TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0;

-- 6. Insert Default Schedule (Sun-Thu 8:00 AM to 3:00 PM, Fri-Sat Off)
DO $$
DECLARE
    default_schedule_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.work_schedules WHERE is_default = true) THEN
        INSERT INTO public.work_schedules (name, type, is_default, grace_period_minutes)
        VALUES ('الجدول الافتراضي (صباحي)', 'fixed', true, 15)
        RETURNING id INTO default_schedule_id;

        -- Insert days
        -- 0: Sunday (Work)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day, start_time, end_time)
        VALUES (default_schedule_id, 0, false, '08:00:00', '15:00:00');
        -- 1: Monday (Work)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day, start_time, end_time)
        VALUES (default_schedule_id, 1, false, '08:00:00', '15:00:00');
        -- 2: Tuesday (Work)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day, start_time, end_time)
        VALUES (default_schedule_id, 2, false, '08:00:00', '15:00:00');
        -- 3: Wednesday (Work)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day, start_time, end_time)
        VALUES (default_schedule_id, 3, false, '08:00:00', '15:00:00');
        -- 4: Thursday (Work)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day, start_time, end_time)
        VALUES (default_schedule_id, 4, false, '08:00:00', '15:00:00');
        -- 5: Friday (Rest)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day)
        VALUES (default_schedule_id, 5, true);
        -- 6: Saturday (Rest)
        INSERT INTO public.work_schedule_days (schedule_id, day_of_week, is_rest_day)
        VALUES (default_schedule_id, 6, true);
    END IF;
END $$;

-- 7. RLS and Security
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything, everyone can read
CREATE POLICY "Admins can manage schedules" ON public.work_schedules FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin' AND admin_role IN ('developer', 'general'))
);
CREATE POLICY "Everyone can read schedules" ON public.work_schedules FOR SELECT USING (true);

CREATE POLICY "Admins can manage schedule days" ON public.work_schedule_days FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin' AND admin_role IN ('developer', 'general'))
);
CREATE POLICY "Everyone can read schedule days" ON public.work_schedule_days FOR SELECT USING (true);

CREATE POLICY "Admins can manage holidays" ON public.public_holidays FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin' AND admin_role IN ('developer', 'general'))
);
CREATE POLICY "Everyone can read holidays" ON public.public_holidays FOR SELECT USING (true);

-- 8. Update Cron function to use work_schedules
CREATE OR REPLACE FUNCTION public.process_daily_attendance()
RETURNS void AS $$
DECLARE
    emp_rec RECORD;
    target_date DATE;
    expected_in TIMESTAMP WITH TIME ZONE;
    expected_out TIMESTAMP WITH TIME ZONE;
    existing_record RECORD;
    i INT;
    day_name TEXT;
BEGIN
    -- Loop through all active employees
    FOR emp_rec IN 
        SELECT p.id as employee_id, ws.start_time as shift_start, ws.end_time as shift_end, ws.weekend_days
        FROM public.profiles p
        JOIN public.work_schedules ws ON 
             (p.work_schedule_id IS NOT NULL AND ws.id = p.work_schedule_id)
             OR (p.work_schedule_id IS NULL AND ws.is_default = true)
        WHERE p.role != 'admin'
    LOOP
        -- Check both yesterday and today to handle crossing midnight shifts
        FOR i IN 0..1 LOOP
            target_date := CURRENT_DATE - (1 - i) * INTERVAL '1 day';
            day_name := to_char(target_date, 'Day');
            
            -- Skip if it's a weekend or a holiday
            IF emp_rec.weekend_days::text LIKE '%' || trim(day_name) || '%' THEN
                CONTINUE;
            END IF;

            IF EXISTS(SELECT 1 FROM public.public_holidays WHERE date = target_date) THEN
                CONTINUE;
            END IF;
            
            -- Calculate expected shift times
            expected_in := (target_date || ' ' || emp_rec.shift_start)::TIMESTAMP WITH TIME ZONE;
            
            IF emp_rec.shift_start < emp_rec.shift_end THEN
                expected_out := (target_date || ' ' || emp_rec.shift_end)::TIMESTAMP WITH TIME ZONE;
            ELSE
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
                    -- No check in at all, record absent
                    INSERT INTO public.attendance_records (
                        employee_id, check_in, check_out, status, is_auto_check_in, is_auto_check_out
                    ) VALUES (
                        emp_rec.employee_id, expected_in, expected_out, 'absent', true, true
                    );
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
