CREATE OR REPLACE FUNCTION public.fix_auth_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_res JSONB;
BEGIN
  -- Fix potentially null fields that break GoTrue scanner
  UPDATE auth.users SET is_anonymous = false WHERE is_anonymous IS NULL;
  UPDATE auth.users SET is_sso_user = false WHERE is_sso_user IS NULL;
  UPDATE auth.users SET is_super_admin = false WHERE is_super_admin IS NULL;
  UPDATE auth.users SET phone = '' WHERE phone IS NULL; 
  -- Note: phone might need to be null if unique constraint exists, so we only update boolean flags first
  
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
