CREATE OR REPLACE FUNCTION public.rpc_delete_user_auth(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_exists BOOLEAN;
    v_result JSONB;
BEGIN
    -- Check if user exists in auth.users
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;

    IF v_user_exists THEN
        -- Delete the user from auth.users (this should cascade to auth.identities)
        DELETE FROM auth.users WHERE id = p_user_id;

        v_result := jsonb_build_object('success', true, 'action', 'deleted');
    ELSE
        -- Return true anyway as the goal is achieved
        v_result := jsonb_build_object('success', true, 'action', 'not_found');
    END IF;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_user_auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_auth TO service_role;
