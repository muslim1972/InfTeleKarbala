WITH lines AS (
  SELECT unnest(string_to_array(prosrc, E'\n')) as line,
         generate_subscripts(string_to_array(prosrc, E'\n'), 1) as line_num
  FROM pg_proc WHERE proname = 'closeout_prev_day_attendance'
)
SELECT line_num, line FROM lines WHERE line_num BETWEEN 25 AND 65;
