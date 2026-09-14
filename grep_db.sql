SELECT proname, prosrc FROM pg_proc WHERE prosrc ILIKE '%password_hash%';
