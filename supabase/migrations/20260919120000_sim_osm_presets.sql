-- ============================================================
-- قوالب OSM الأساسية لمحاكي FTTH — قابلة للإدارة من الواجهة
-- ============================================================
-- سابقاً كانت القوالب «الأساسية» ثابتة في الكود (OSM_PRESETS في
-- src/features/fiber-simulator/gis/osm-areas.ts) وأي تعديل يتطلب
-- بناء ونشر. هذا الجدول يجعلها حيّة: يديرها حساب المطور من لوحة
-- داخل نافذة استيراد GIS، ويترى أثرها فوراً على جميع المستخدمين
-- دون نشر جديد.
--
-- العزل الكامل: جدول جديد لا يمس أي جدول من التطبيق الأساسي،
-- ويمكن حذفه لاحقاً دون أي أثر (يعود التطبيق تلقائياً للقائمة
-- المدمجة بالكود عند تعذر القراءة).
--
-- الصلاحيات:
--  - القراءة: للجميع بلا قيد (بيانات جغرافية عامة كانت أصلاً في
--    حزمة الكود العامة) — تشمل الزوار بلا جلسة Supabase.
--  - الكتابة: حساب المطور فقط — نفس فحوص isDeveloperAccount في
--    src/features/fiber-simulator/security/feature-gate.ts،
--    ويُطبَّق على مستوى RLS فالواجهة ليست الضمانة النهائية.
--
-- الأمان الذري: BEGIN/COMMIT — أي فشل (كعدم توفر عمود في profiles)
-- يتراجع عن الملف كاملاً ولا يترك الجدول نصف مُهيأ، ويعود التطبيق
-- للقائمة المدمجة تلقائياً. لا حاجة لأي خطوة ترميم يدوية.

begin;

-- ------------------------------------------------------------
-- 1) الجدول — قيود مطابقة تماماً لتحقق الواجهة (نفس حدود القوالب
--    المخصصة: صندوق 100م–5كم للضلع)
-- ------------------------------------------------------------
create table if not exists public.sim_osm_presets (
  id         text primary key,
  label      text not null unique
             check (char_length(btrim(label)) between 2 and 60),
  hint       text not null default '' check (char_length(hint) <= 120),
  south      double precision not null check (south >= -90   and south <= 90),
  west       double precision not null check (west  >= -180  and west  <= 180),
  north      double precision not null check (north >= -90   and north <= 90),
  east       double precision not null check (east  >= -180  and east  <= 180),
  check (north > south and east > west),
  check (north - south between 0.001 and 0.05),
  check (east - west  between 0.001 and 0.05),
  created_at timestamptz not null default now()
);

comment on table public.sim_osm_presets is
  'محاكي FTTH: قوالب OSM الأساسية — تديرها لوحة المطور وتقرأها كل الحسابات (ميزة معزولة)';

alter table public.sim_osm_presets enable row level security;

-- ------------------------------------------------------------
-- 2) فحص حساب المطور — SECURITY DEFINER لتفادي التفاف RLS على
--    profiles (التنفيذ بحساب postgres فتتجاوز الدالة RLS بلا أي
--    خيار تصعيد: تقرأ الأعمدة الثلاثة وتعيد true/false فقط).
--    التحويل ::text دفاعي ضد اختلاف نوع job_number بين البيئات.
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
-- 3) السياسات
-- ------------------------------------------------------------
drop policy if exists sim_osm_presets_public_read on public.sim_osm_presets;
create policy sim_osm_presets_public_read
  on public.sim_osm_presets
  for select
  using (true);

drop policy if exists sim_osm_presets_manager_insert on public.sim_osm_presets;
create policy sim_osm_presets_manager_insert
  on public.sim_osm_presets
  for insert
  to authenticated
  with check (public.sim_is_preset_manager());

drop policy if exists sim_osm_presets_manager_update on public.sim_osm_presets;
create policy sim_osm_presets_manager_update
  on public.sim_osm_presets
  for update
  to authenticated
  using (public.sim_is_preset_manager())
  with check (public.sim_is_preset_manager());

drop policy if exists sim_osm_presets_manager_delete on public.sim_osm_presets;
create policy sim_osm_presets_manager_delete
  on public.sim_osm_presets
  for delete
  to authenticated
  using (public.sim_is_preset_manager());

-- ------------------------------------------------------------
-- 4) بذرة القوالب الحالية — نفس معرفات وأسماء الكود حرفياً حتى لا
--    يتغير أي شيء أمام المستخدمين بعد التطبيق؛ التعديل لاحقاً من
--    لوحة المطور فقط.
-- ------------------------------------------------------------
insert into public.sim_osm_presets (id, label, hint, south, west, north, east) values
  ('karbala-east',    'كربلاء — شرق الحرم',     'حي سكني منتظم خلف سور الإمام الحسين (ع)', 32.618,  44.038,  32.621,  44.042),
  ('karbala-abbas',   'كربلاء — حي العباس',     'منطقة سكنية غرب الحرم، شبكة شوارع متعرّجة', 32.61,   44.022,  32.6135, 44.026),
  ('najaf-old',       'النجف — المدينة القديمة', 'نسيج عمراني كثيف قرب الإمام علي (ع)',      32.0005, 44.3325, 32.0035, 44.3355),
  ('baghdad-karrada', 'بغداد — الكرادة',        'منطقة تجارية سكنية داخل بغداد',            33.317,  44.429,  33.32,   44.432),
  ('karbala-south',   'كربلاء — جنوب المدينة',  'حي سكني هادئ — مناسب للمبتدئين',           32.596,  44.018,  32.599,  44.022)
on conflict (id) do nothing;

commit;
