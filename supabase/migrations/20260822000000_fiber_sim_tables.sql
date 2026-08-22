-- ============================================================
-- محاكي بناء شبكات الألياف الضوئية (FTTH Simulator)
-- جداول معزولة بالكامل تحت بادئة fiber_sim_*
-- ============================================================
-- الهدف: عدم لمس أي جدول قائم في التطبيق الأساسي، بحيث يمكن
-- حذف هذه الجداول لاحقاً دون أي أثر على بقية النظام.
-- ملاحظة: الميزة تظهر حالياً لحساب المطور فقط (فحص على مستوى
-- الواجهة)، وسياسات RLS أدناه تضمن أن كل مستخدم يرى بياناته فقط.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) مشاريع المحاكي (حفظ/استرجاع التصاميم)
-- ------------------------------------------------------------
create table if not exists public.fiber_sim_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  map_id      text not null,
  name        text not null default 'مشروع بلا اسم',
  phase       text not null default 'civil'
              check (phase in ('civil', 'optical', 'splicing', 'testing')),
  entities    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.fiber_sim_projects is
  'محاكي FTTH: مشاريع التصميم المحفوظة (الميزة معزولة بالكامل)';

create index if not exists idx_fiber_sim_projects_user
  on public.fiber_sim_projects (user_id, updated_at desc);

-- ------------------------------------------------------------
-- 2) نتائج المحاولات (التقييم والتكلفة والنجوم)
-- ------------------------------------------------------------
create table if not exists public.fiber_sim_scores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  map_id         text not null,
  total_cost_usd numeric(12,2) not null default 0,
  coverage_homes integer not null default 0,
  optical_pass   boolean not null default false,
  stars          smallint not null default 0 check (stars between 0 and 5),
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.fiber_sim_scores is
  'محاكي FTTH: سجل نتائج المحاولات والتقييم (الميزة معزولة بالكامل)';

create index if not exists idx_fiber_sim_scores_user
  on public.fiber_sim_scores (user_id, created_at desc);

-- ------------------------------------------------------------
-- سياسات العزل على مستوى الصفوف (RLS)
-- ------------------------------------------------------------
alter table public.fiber_sim_projects enable row level security;
alter table public.fiber_sim_scores  enable row level security;

drop policy if exists fiber_sim_projects_owner on public.fiber_sim_projects;
create policy fiber_sim_projects_owner
  on public.fiber_sim_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists fiber_sim_scores_owner on public.fiber_sim_scores;
create policy fiber_sim_scores_owner
  on public.fiber_sim_scores
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
