SELECT column_name, privilege_type, grantee FROM information_schema.column_privileges WHERE table_name='profiles' AND column_name IN ('password', 'password_hash');
