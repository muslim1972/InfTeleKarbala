SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('roster_evaluate_all', 'roster_evaluate_day', 'closeout_prev_day_attendance', 'resolve_shift_absence_or_penalty');
