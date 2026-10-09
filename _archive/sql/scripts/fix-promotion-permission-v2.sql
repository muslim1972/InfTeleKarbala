CREATE OR REPLACE FUNCTION public.set_promotion_permission(
    target_user_id uuid,
    make_supervisor boolean,
    make_student boolean,
    p_course_type text DEFAULT NULL,
    p_subject_name text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    my_role text;
    my_gov text;
    my_lecturer boolean;
BEGIN
    SELECT admin_role, governorate, is_promotion_lecturer
      INTO my_role, my_gov, my_lecturer
    FROM profiles WHERE id = auth.uid();

    IF NOT (
        my_role IN ('developer', 'it_supervisor', 'general')
        OR COALESCE(my_lecturer, false)
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF COALESCE(my_role, '') NOT IN ('developer', 'it_supervisor') THEN
        IF my_gov IS NULL THEN
            RAISE EXCEPTION 'Governorate not set';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM profiles
            WHERE id = target_user_id AND governorate = my_gov
        ) THEN
            RAISE EXCEPTION 'Cross-governorate access denied';
        END IF;
    END IF;

    IF make_supervisor THEN
        UPDATE profiles
        SET is_promotion_lecturer = true,
            can_access_promotion = false,
            promotion_course_type = NULL,
            promotion_subject_name = NULL
        WHERE id = target_user_id;
    ELSIF make_student THEN
        UPDATE profiles
        SET can_access_promotion = true,
            is_promotion_lecturer = false,
            promotion_course_type = p_course_type,
            promotion_subject_name = p_subject_name
        WHERE id = target_user_id;
    ELSE
        UPDATE profiles
        SET can_access_promotion = false,
            is_promotion_lecturer = false,
            promotion_course_type = NULL,
            promotion_subject_name = NULL
        WHERE id = target_user_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_promotion_permission(
    target_user_id uuid,
    make_supervisor boolean,
    make_student boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM public.set_promotion_permission(target_user_id, make_supervisor, make_student, NULL::text, NULL::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_promotion_permission(uuid, boolean, boolean, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_promotion_permission(uuid, boolean, boolean, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_promotion_permission(uuid, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_promotion_permission(uuid, boolean, boolean) TO authenticated;
