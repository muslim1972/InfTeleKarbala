-- ============================================================
-- إصلاح أمني حرج: سياسات RLS لجداول المحاكي كانت مفسوخة
-- ============================================================
-- السياسة القديمة:
--   ((auth.uid() = user_id) OR (auth.role() = 'authenticated'))
-- الشرط الثاني يفتح كل الصفوف لأي مستخدم مصادق — أي حساب يرى
-- ويعدّل ويحذف مشاريع ونتائج الجميع عبر API (ثغرة IDOR).
--
-- الإصلاح: عزل مالك فقط — auth.uid() = user_id بلا استثناءات.
-- العرض المشترك الوحيد المتعمّد في المحاكي هو مكتبة الخرائط
-- sim_map_library (سياساتها منفصلة وسليمة).

begin;

-- ------------------------------------------------------------
-- 1) fiber_sim_projects — مشاريع المحاكي الخاصة بكل مستخدم
-- ------------------------------------------------------------
drop policy if exists fiber_sim_projects_owner on public.fiber_sim_projects;
create policy fiber_sim_projects_owner
  on public.fiber_sim_projects
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) fiber_sim_scores — نتائج المحاولات الخاصة بكل مستخدم
-- ------------------------------------------------------------
drop policy if exists fiber_sim_scores_owner on public.fiber_sim_scores;
create policy fiber_sim_scores_owner
  on public.fiber_sim_scores
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;

-- ============================================================
-- تشخيص: علاقة profiles بـ auth.users وحسابات تجريبي/سيناء
-- ============================================================
\echo === RLS after fix ===
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('fiber_sim_projects', 'fiber_sim_scores')
order by tablename;

\echo === profiles: تجريبي / سيناء — وهل id = auth uid؟ ===
select p.id,
       p.full_name,
       p.job_number,
       (exists (select 1 from auth.users au where au.id = p.id)) as id_is_auth_uid
from profiles p
where p.full_name like '%تجريبي%' or p.full_name like '%سيناء%'
order by p.full_name;

\echo === كل مالكي مشاريع المحاكي: هل user_id = auth uid؟ ===
select f.user_id,
       pr.full_name,
       (exists (select 1 from auth.users au where au.id = f.user_id)) as owner_is_auth_uid,
       count(*) as projects
from fiber_sim_projects f
left join profiles pr on pr.id = f.user_id
group by f.user_id, pr.full_name
order by projects desc;
