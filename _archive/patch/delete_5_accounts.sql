DO $$
DECLARE
    v_ids uuid[] := ARRAY[
        'c9fdbd6c-f018-438a-9f66-72b322ab9c9f'::uuid, -- KIOSK-SVC
        'e0931fc3-cea4-42cb-8173-67e720539593'::uuid, -- _DEL_999_
        '59126b62-0d38-45e4-a47d-c8b7431c072a'::uuid, -- _DEL_TEMP_
        '6c7599d4-efa0-4059-904c-07cde16ff3a1'::uuid, -- 103888888
        '5d5d5ba9-737f-49b7-8098-1eadad2f9144'::uuid  -- c111213
    ];
    uid uuid;
BEGIN
    FOREACH uid IN ARRAY v_ids LOOP
        -- 1. Attendance & Biometrics
        BEGIN DELETE FROM public.attendance_logs WHERE employee_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.attendance_records WHERE employee_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.work_location_employees WHERE employee_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.device_change_requests WHERE employee_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.biometric_registrations WHERE employee_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 2. Financial & Admin Summary
        BEGIN DELETE FROM public.financial_records WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.administrative_summary WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.yearly_records WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 3. Leaves & Requests
        BEGIN DELETE FROM public.leave_requests WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.five_year_leaves WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.service_continuity_requests WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 4. Messaging & Calls
        BEGIN DELETE FROM public.messages WHERE sender_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.hr_audio_calls WHERE sender_id = uid OR recipient_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN DELETE FROM public.poll_responses WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 5. Field change & Audit logs
        BEGIN UPDATE public.activity_logs SET user_id = NULL WHERE user_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE public.field_change_logs SET changed_by = NULL WHERE changed_by = uid; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN UPDATE public.leave_history SET actor_id = NULL WHERE actor_id = uid; EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 6. Profile
        DELETE FROM public.profiles WHERE id = uid;

        -- 7. Auth User
        DELETE FROM auth.users WHERE id = uid;
    END LOOP;
END $$;
