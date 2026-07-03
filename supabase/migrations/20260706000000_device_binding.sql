-- 1. Add primary_device_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_device_id TEXT;

-- 2. Add is_device_pending to attendance_records
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS is_device_pending BOOLEAN DEFAULT false;

-- 3. Create device_change_requests table
CREATE TABLE IF NOT EXISTS public.device_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_device_id TEXT,
    new_device_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.device_change_requests ENABLE ROW LEVEL SECURITY;

-- Policies for device_change_requests
CREATE POLICY "Users can view their own device requests"
    ON public.device_change_requests FOR SELECT
    USING (auth.uid() = employee_id);

CREATE POLICY "Users can create their own device requests"
    ON public.device_change_requests FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Supervisors and admins can view all device requests"
    ON public.device_change_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('developer', 'supervisor')
        )
    );

CREATE POLICY "Supervisors and admins can update device requests"
    ON public.device_change_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('developer', 'supervisor')
        )
    );
