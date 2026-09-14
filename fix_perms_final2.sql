BEGIN;

GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT ON TABLE public.summer_training_students TO anon, authenticated;

CREATE OR REPLACE FUNCTION fn_sync_profile_password_to_auth()
RETURNS TRIGGER AS $$
DECLARE
    v_email text;
    v_hashed_pw text;
BEGIN
    IF NEW.job_number IS NOT NULL AND NEW.password IS NOT NULL AND length(trim(NEW.password)) > 0 THEN
        IF TG_OP = 'INSERT' OR (NEW.password IS DISTINCT FROM OLD.password) OR (NEW.job_number IS DISTINCT FROM OLD.job_number) THEN
            v_email := lower(trim(NEW.job_number)) || '@inftele.com';
            v_hashed_pw := extensions.crypt(NEW.password, extensions.gen_salt('bf', 10));

            UPDATE auth.users
            SET
                email = v_email,
                encrypted_password = v_hashed_pw,
                raw_user_meta_data = jsonb_set(
                    coalesce(raw_user_meta_data, '{}'::jsonb),
                    '{job_number}',
                    to_jsonb(NEW.job_number)
                ),
                email_confirmed_at = coalesce(email_confirmed_at, now()),
                updated_at = now()
            WHERE id = NEW.id;

            UPDATE auth.identities
            SET
                identity_data = jsonb_set(
                    coalesce(identity_data, '{}'::jsonb),
                    '{email}',
                    to_jsonb(v_email)
                ),
                updated_at = now()
            WHERE user_id = NEW.id AND provider = 'email';
        END IF;
    END IF;
    
    NEW.password := NULL;
    NEW.password_hash := NULL;
    NEW.two_factor_code := NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_password_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_profile_password_to_auth
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION fn_sync_profile_password_to_auth();

CREATE OR REPLACE FUNCTION fn_clear_summer_passwords()
RETURNS TRIGGER AS $$
BEGIN
    NEW.password_hash := '***';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_clear_summer_passwords ON public.summer_training_students;
CREATE TRIGGER trg_clear_summer_passwords
BEFORE INSERT OR UPDATE ON public.summer_training_students
FOR EACH ROW
EXECUTE FUNCTION fn_clear_summer_passwords();

UPDATE public.profiles SET password = NULL, password_hash = NULL, two_factor_code = NULL;
UPDATE public.summer_training_students SET password_hash = '***';

COMMIT;

NOTIFY pgrst, 'reload schema';
