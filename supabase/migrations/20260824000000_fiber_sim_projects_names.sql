-- ============================================================
-- محاكي FTTH: دعم مشاريع متعددة مسماة لكل مستخدم
-- ============================================================
-- الغرض: تمكين «حفظ باسم جديد» (Save As) وقائمة «فتح المشروع»
-- عبر منع تضارب أسماء المشاريع للمستخدم الواحد على مستوى
-- قاعدة البيانات (فهرس فريد) — لا يتأثر أي جدول آخر.

-- 1) إزالة أي تكرار تاريخي بالاسم نفسه للمستخدم الواحد
--    (يبقى الأحدث تعديلاً فقط) كي ينجح إنشاء الفهرس الفريد
delete from public.fiber_sim_projects p
using public.fiber_sim_projects q
where p.user_id = q.user_id
  and p.name = q.name
  and p.updated_at < q.updated_at;

-- 2) فهرس فريد: اسم المشروع مميز لكل مستخدم
--    (يضمن سلامة «الحفظ باسم جديد» ويمنع الكتابة فوق مشروع
--    آخر بالاسم نفسه عن طريق الخطأ)
create unique index if not exists uq_fiber_sim_projects_user_name
  on public.fiber_sim_projects (user_id, name);

-- 3) فهرس استرجاع أحدث مشروع لكل خريطة (الاسترجاع التلقائي)
create index if not exists idx_fiber_sim_projects_user_map
  on public.fiber_sim_projects (user_id, map_id, updated_at desc);
