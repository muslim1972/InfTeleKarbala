SELECT array_length(string_to_array(prosrc, E'\n'), 1) as total_lines 
FROM pg_proc WHERE proname = 'closeout_prev_day_attendance';

SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'closeout_prev_day_attendance';
