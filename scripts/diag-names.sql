\echo == آخر المشاريع في fiber_sim_projects ==
select p.id, pr.full_name as owner, p.name, p.map_id, p.updated_at
from fiber_sim_projects p
left join profiles pr on pr.id = p.user_id
order by p.updated_at desc limit 15;

\echo == مكتبة الخرائط sim_map_library ==
select id, label, created_by from sim_map_library order by created_at desc limit 10;
