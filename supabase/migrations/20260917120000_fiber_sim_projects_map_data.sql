-- ============================================================
-- محاكي FTTH: تخزين خريطة GIS المستوردة مع المشروع
-- ============================================================
-- الهدف: التخلص من حفظ الخرائط في حزمة التطبيق (public/) تماماً.
-- الخريطة المستوردة (GeoJSON → SimMap) تُخزَّن مع بيانات المشروع
-- في قاعدة البيانات، فيستطيع المستخدم فتح مشروعه من أي جهاز
-- وتجد الخريطة نفسها — دون أي ملفات على القرص.
--
-- الأمان: العمود محمي بنفس سياسة RLS الموجودة (fiber_sim_projects_owner)
-- التي تقيّد كل العمليات على مالك الصف. لا تغيير في الصلاحيات.

alter table public.fiber_sim_projects
  add column if not exists map_data jsonb;

comment on column public.fiber_sim_projects.map_data is
  'محاكي FTTH: خريطة GIS المستوردة كاملةً (SimMap) — تُخزن مع المشروع ليتسنى فتحه على أي جهاز دون ملفات محلية';

-- فهجام للاستعلام عن المشاريع التي تحوي خريطة مستوردة
create index if not exists fiber_sim_projects_map_data_idx
  on public.fiber_sim_projects ((map_data is not null))
  where map_data is not null;
