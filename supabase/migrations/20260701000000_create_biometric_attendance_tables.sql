-- =============================================
-- Biometric Attendance System Tables
-- =============================================

-- 1. Fingerprint Templates Table
CREATE TABLE IF NOT EXISTS public.fingerprint_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_data BYTEA NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    UNIQUE(employee_id, template_version)
);

-- 2. Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id),
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    check_in_location TEXT,
    check_out_location TEXT,
    check_in_verified_by_biometric BOOLEAN DEFAULT false,
    check_out_verified_by_biometric BOOLEAN DEFAULT false,
    check_in_device_id TEXT,
    check_out_device_id TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'present',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES public.profiles(id)
);

-- 3. Attendance Devices Table
CREATE TABLE IF NOT EXISTS public.attendance_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    location TEXT,
    department_id UUID REFERENCES public.departments(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Attendance Exceptions Table
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    exception_type TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

-- Fingerprint Templates Policies
CREATE POLICY "Employees can view their own templates"
    ON public.fingerprint_templates FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Admins can manage all fingerprint templates"
    ON public.fingerprint_templates FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'hr_manager')));

-- Attendance Records Policies
CREATE POLICY "Employees can view their own attendance"
    ON public.attendance_records FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Admins can manage all attendance records"
    ON public.attendance_records FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'hr_manager')));

CREATE POLICY "Employees can create their own attendance"
    ON public.attendance_records FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

-- Attendance Devices Policies
CREATE POLICY "Everyone can view active devices"
    ON public.attendance_devices FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage attendance devices"
    ON public.attendance_devices FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'hr_manager')));

-- Attendance Exceptions Policies
CREATE POLICY "Employees can view and create their own exceptions"
    ON public.attendance_exceptions FOR ALL
    USING (auth.uid() = employee_id);

CREATE POLICY "Admins can manage all attendance exceptions"
    ON public.attendance_exceptions FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'hr_manager', 'supervisor')));

-- =============================================
-- Comments in Arabic
-- =============================================

COMMENT ON TABLE public.fingerprint_templates IS 'قوالب البصمات للموظفين';
COMMENT ON TABLE public.attendance_records IS 'سجلات الحضور والانصراف';
COMMENT ON TABLE public.attendance_devices IS 'أجهزة تسجيل الحضور';
COMMENT ON TABLE public.attendance_exceptions IS 'الاستثناءات من الحضور (إجازات، إلخ)';
