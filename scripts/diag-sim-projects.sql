-- تشخيص عزل مشاريع المحاكي — هل RLS مفعّل وما السياسات؟
\echo === RLS enabled? ===
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('fiber_sim_projects', 'fiber_sim_scores');

\echo === policies ===
select tablename, policyname, permissive, cmd, qual, with_check
from pg_policies
where tablename in ('fiber_sim_projects', 'fiber_sim_scores')
order by tablename, policyname;

\echo === grants ===
select grantee, privilege_type
from information_schema.role_table_grants
where table_name in ('fiber_sim_projects', 'fiber_sim_scores')
order by table_name, grantee, privilege_type;

\echo === rows per owner (with profile name) ===
select f.user_id,
       pr.full_name,
       pr.job_number,
       count(*) as projects,
       string_agg(left(f.name, 40), ' | ' order by f.updated_at desc) as names
from fiber_sim_projects f
left join profiles pr on pr.id = f.user_id
group by f.user_id, pr.full_name, pr.job_number
order by projects desc;

\echo === duplicate profiles sharing same auth id / similar names ===
select id, full_name, job_number, admin_role, created_at
from profiles
where full_name like '%تجريبي%' or full_name like '%سيناء%' or full_name like '%حي السلام%'
order by created_at;
