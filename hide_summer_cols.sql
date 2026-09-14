BEGIN;
REVOKE SELECT ON TABLE public.summer_training_students FROM anon, authenticated;
GRANT SELECT (id, full_name, username, institution_name, exam_grade, supervisor_id, created_at, training_location, trainer_name) ON TABLE public.summer_training_students TO anon, authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
