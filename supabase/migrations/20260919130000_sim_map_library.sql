-- ============================================================
-- مكتبة خرائط المحاكي المشتركة — ملفات GeoJSON كاملة في DB
-- ============================================================
-- النموذج الجديد بعد إلغاء الجلب الحيّ من OpenStreetMap نهائياً
-- (قرار الوزارة: لا أي روابط API خارجية غير المرخّصة):
--  - لا قوالب bbox ولا استعلامات شبكة — الخرائط ملفات GeoJSON
--     حقيقية يرفعها حساب المطور من جهازه إلى المكتبة.
--  - القائمة تبدأ فارغة: كل صف = ملف GeoJSON كامل (map_data jsonb)
--    باسم معروض يفتحه أي مستخدم من قائمة المكتبة.
--  - حفظ المستخدم لمشروعه لا يتغير: يبقى في مساحته الخاصة.
--
-- الصلاحيات:
--  - القراءة: للجميع — المكتبة مشتركة لكل مستخدمي المحاكي.
--  - الكتابة: حساب المطور فقط عبر sim_is_preset_manager() نفسها
--    (SECURITY DEFINER) — الضمانة النهائية على مستوى RLS.
--
-- تنظيف النموذج القديم: إسقاط sim_osm_presets (سياساته تُسقط
-- معه تلقائياً).

begin;

-- ------------------------------------------------------------
-- 1) إسقاط جدول قوالب bbox القديم
-- ------------------------------------------------------------
drop table if exists public.sim_osm_presets;

-- ------------------------------------------------------------
-- 2) فحص حساب المطور — SECURITY DEFINER (نفس الفحوص السابقة:
--    admin_role / job_number / الاسم). مضمّن هنا ليكون الملف
--    قائماً بذاته على أي بيئة جديدة.
-- ------------------------------------------------------------
create or replace function public.sim_is_preset_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.admin_role::text in ('developer', 'it_supervisor')
        or p.job_number::text = '103130486'
        or p.full_name::text like '%مسلم عقيل%'
        or p.full_name::text like '%مسلم قيل%'
      )
  );
$func$;

-- ------------------------------------------------------------
-- 3) جدول المكتبة — القيود مطابقة لتحقق الواجهة (حد 8MB للملف)
-- ------------------------------------------------------------
create table if not exists public.sim_map_library (
  id              uuid primary key default gen_random_uuid(),
  label           text not null unique
                  check (char_length(btrim(label)) between 2 and 80),
  map_data        jsonb not null
                  check (jsonb_typeof(map_data) = 'object'),
  buildings_count integer not null default 0
                  check (buildings_count between 0 and 100000),
  roads_count     integer not null default 0
                  check (roads_count between 0 and 100000),
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  check (pg_column_size(map_data) <= 8388608)
);

comment on table public.sim_map_library is
  'محاكي FTTH: مكتبة خرائط GeoJSON مشتركة — يرفعها المطور ويقرأها جميع المستخدمين (ميزة معزولة)';

alter table public.sim_map_library enable row level security;

-- ------------------------------------------------------------
-- 4) السياسات
-- ------------------------------------------------------------
drop policy if exists sim_map_library_public_read on public.sim_map_library;
create policy sim_map_library_public_read
  on public.sim_map_library
  for select
  using (true);

drop policy if exists sim_map_library_manager_insert on public.sim_map_library;
create policy sim_map_library_manager_insert
  on public.sim_map_library
  for insert
  to authenticated
  with check (public.sim_is_preset_manager());

drop policy if exists sim_map_library_manager_delete on public.sim_map_library;
create policy sim_map_library_manager_delete
  on public.sim_map_library
  for delete
  to authenticated
  using (public.sim_is_preset_manager());

commit;
