\echo == RLS enabled ==
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('fiber_sim_projects','fiber_sim_scores');

\echo == policies (must be owner-only: auth.uid() = user_id) ==
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('fiber_sim_projects','fiber_sim_scores')
order by tablename, policyname;
