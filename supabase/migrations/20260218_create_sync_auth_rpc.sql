-- Function to sync profile users with Supabase Auth
-- This function runs with SECURITY DEFINER to allow the frontend to create/update auth users
-- without having service role keys.

CREATE OR REPLACE FUNCTION public.rpc_sync_user_auth(
    p_user_id UUID,
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_exists BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Check if user exists in auth.users
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;

    IF v_user_exists THEN
        -- 2. Update existing user password
        UPDATE auth.users 
        SET 
            encrypted_password = crypt(p_password, gen_salt('bf')),
            email = p_email,
            last_sign_in_at = NULL -- Optional: force re-login if needed
        WHERE id = p_user_id;
        
        v_result := jsonb_build_object('success', true, 'action', 'updated');
    ELSE
        -- 3. Create new user in auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token
        )
        VALUES (
            p_user_id,
            '00000000-0000-0000-0000-000000000000',
            p_email,
            crypt(p_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            'authenticated',
            'authenticated',
            ''
        );
        
        -- Also create identity record for login to work correctly
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        )
        VALUES (
            p_user_id,
            p_user_id,
            jsonb_build_object('sub', p_user_id, 'email', p_email),
            'email',
            now(),
            now(),
            now()
        );

        v_result := jsonb_build_object('success', true, 'action', 'created');
    END IF;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant access to authenticated users (admins)
GRANT EXECUTE ON FUNCTION public.rpc_sync_user_auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sync_user_auth TO service_role;
