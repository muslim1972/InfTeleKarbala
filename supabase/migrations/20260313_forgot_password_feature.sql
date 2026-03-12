-- 1. Create system_notifications table if not exists
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- e.g., 'forgot_password'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Ensure RLS is enabled
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Idempotent Policy Management
DO $$
BEGIN
    -- Drop existing policies to prevent conflict errors
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.system_notifications;
    DROP POLICY IF EXISTS "System can insert notifications" ON public.system_notifications;
    DROP POLICY IF EXISTS "Users can mark their own notifications as read" ON public.system_notifications;
END
$$;

-- 4. Re-create Policies
CREATE POLICY "Users can view their own notifications"
    ON public.system_notifications FOR SELECT
    USING (auth.uid() = recipient_id);

CREATE POLICY "System can insert notifications"
    ON public.system_notifications FOR INSERT
    WITH CHECK (true); -- Used by SECURITY DEFINER function

CREATE POLICY "Users can mark their own notifications as read"
    ON public.system_notifications FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- 5. Safe Function Update
-- We explicitly drop the exact signature found in your inspection (p_username text)
-- to allow changing the argument list without creating an "overloaded" duplicate.
DROP FUNCTION IF EXISTS public.rpc_handle_forgot_password(text);
DROP FUNCTION IF EXISTS public.rpc_handle_forgot_password(text, boolean);

-- 6. Create the multi-step function
CREATE OR REPLACE FUNCTION public.rpc_handle_forgot_password(p_username TEXT, p_confirm BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_profile RECORD;
    v_supervisor_id UUID;
    v_supervisor_name TEXT;
    v_temp_password TEXT;
    v_dept_id UUID;
    v_current_dept_id UUID;
BEGIN
    -- 1. Find the user by username
    SELECT * INTO v_user_profile FROM public.profiles WHERE username = p_username;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
    END IF;

    -- 2. Find Supervisor based on hierarchy
    v_current_dept_id := v_user_profile.department_id;
    v_supervisor_id := NULL;

    WHILE v_current_dept_id IS NOT NULL LOOP
        SELECT manager_id, parent_id INTO v_supervisor_id, v_dept_id 
        FROM public.departments 
        WHERE id = v_current_dept_id;

        -- If manager exists and is NOT the user themselves
        IF v_supervisor_id IS NOT NULL AND v_supervisor_id != v_user_profile.id THEN
            EXIT;
        END IF;

        -- Escalate to parent
        v_current_dept_id := v_dept_id;
    END LOOP;

    -- If no supervisor found even at top level, or user is top manager
    IF v_supervisor_id IS NULL OR v_supervisor_id = v_user_profile.id THEN
        -- Fallback: Use administrator if found
         SELECT id, full_name INTO v_supervisor_id, v_supervisor_name 
         FROM public.profiles 
         WHERE admin_role = 'developer' OR full_name LIKE '%مسلم عقيل%'
         LIMIT 1;
    ELSE
        SELECT full_name INTO v_supervisor_name FROM public.profiles WHERE id = v_supervisor_id;
    END IF;

    -- STEP 1: PREVIEW MODE (Confirmation is FALSE)
    -- Just report who the supervisor is
    IF NOT p_confirm THEN
        RETURN jsonb_build_object(
            'success', true, 
            'supervisor_name', v_supervisor_name,
            'action_required', 'confirm'
        );
    END IF;

    -- STEP 2: CONFIRM MODE (Confirmation is TRUE)
    -- Generate secret code and notify supervisor
    
    -- 3. Generate 6-digit random number
    v_temp_password := lpad(floor(random() * 1000000)::text, 6, '0');

    -- 4. Update Auth password (requires extensions like pgcrypto, usually active in Supabase)
    UPDATE auth.users 
    SET encrypted_password = crypt(v_temp_password, gen_salt('bf'))
    WHERE id = v_user_profile.id;

    -- 5. Update profiles password column
    UPDATE public.profiles 
    SET password = v_temp_password
    WHERE id = v_user_profile.id;

    -- 6. Insert notification for supervisor
    INSERT INTO public.system_notifications (
        recipient_id,
        sender_id,
        type,
        title,
        content,
        metadata
    ) VALUES (
        v_supervisor_id,
        v_user_profile.id,
        'forgot_password',
        'طلب كلمة مرور مؤقتة',
        'كلمة المرور المؤقتة للموظف ' || v_user_profile.full_name || ' = ' || v_temp_password,
        jsonb_build_object(
            'employee_name', v_user_profile.full_name,
            'temp_password', v_temp_password,
            'employee_id', v_user_profile.id
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'supervisor_name', v_supervisor_name,
        'action_completed', 'generated'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7. Grant access explicitly to the new signature
GRANT EXECUTE ON FUNCTION public.rpc_handle_forgot_password(TEXT, BOOLEAN) TO anon, authenticated;
