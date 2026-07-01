-- =============================================
-- نظام الحضور والانصراف — مواقع العمل والسياج الجغرافي
-- يُنفذ في Supabase SQL Editor
-- =============================================

-- 1. جدول مواقع العمل
CREATE TABLE IF NOT EXISTS public.work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. جدول ربط الموظفين بمواقع العمل
CREATE TABLE IF NOT EXISTS public.work_location_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(location_id, employee_id)
);

-- =============================================
-- تفعيل سياسات أمان الصفوف (RLS)
-- =============================================

ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_location_employees ENABLE ROW LEVEL SECURITY;

-- =============================================
-- سياسات مواقع العمل
-- =============================================

-- الجميع يمكنهم عرض المواقع النشطة (لفحص السياج الجغرافي)
CREATE POLICY "Everyone can view active work locations"
    ON public.work_locations FOR SELECT
    USING (is_active = true);

-- المطور والمشرف العام فقط يمكنهم إدارة المواقع
CREATE POLICY "Admins can manage work locations"
    ON public.work_locations FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'admin' 
            AND admin_role IN ('developer', 'general')
        )
    );

-- =============================================
-- سياسات ربط الموظفين بالمواقع
-- =============================================

-- الموظف يرى مواقعه المربوطة فقط
CREATE POLICY "Employees can view their own location assignments"
    ON public.work_location_employees FOR SELECT
    USING (auth.uid() = employee_id);

-- المطور والمشرف العام يمكنهم إدارة جميع الربط
CREATE POLICY "Admins can manage all location assignments"
    ON public.work_location_employees FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles 
            WHERE role = 'admin' 
            AND admin_role IN ('developer', 'general')
        )
    );

-- =============================================
-- فهارس لتحسين الأداء
-- =============================================

CREATE INDEX IF NOT EXISTS idx_work_locations_active 
    ON public.work_locations(is_active);

CREATE INDEX IF NOT EXISTS idx_work_location_employees_location 
    ON public.work_location_employees(location_id);

CREATE INDEX IF NOT EXISTS idx_work_location_employees_employee 
    ON public.work_location_employees(employee_id);

-- =============================================
-- تعليقات توضيحية بالعربية
-- =============================================

COMMENT ON TABLE public.work_locations IS 'مواقع العمل المعتمدة لتسجيل الحضور (السياج الجغرافي)';
COMMENT ON TABLE public.work_location_employees IS 'جدول ربط الموظفين بمواقع العمل المسموحة لهم';
COMMENT ON COLUMN public.work_locations.name IS 'اسم موقع العمل (مثلاً: المبنى الرئيسي)';
COMMENT ON COLUMN public.work_locations.latitude IS 'خط العرض لمركز الموقع';
COMMENT ON COLUMN public.work_locations.longitude IS 'خط الطول لمركز الموقع';
COMMENT ON COLUMN public.work_locations.radius_meters IS 'نصف قطر السياج الجغرافي بالأمتار (افتراضي 50)';
