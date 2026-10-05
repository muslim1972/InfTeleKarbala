-- ============================================================
-- تصحيح تخزين دوام المناوب المسائي: «14:30 - 8:00 م» خُزّنت نهايتها
-- 08:00 (صباحاً) بدل 20:00 (مساءً) فصارت 17.5 ساعة وعابرة لمنتصف الليل،
-- ما جعل نظام الإجازات الزمنية يعامل "الآن" بعد الظهر كأنه تابع لليلة
-- أمس ويرفض طلبات مشروعة. القاعدة المعتمدة: المسائي = 14:30 → 20:00.
-- الحارس is_evening = true يحمي دوامات الليل الحقيقية (20:00 → 08:00).
-- ============================================================

UPDATE work_schedule_days
SET end_time = '20:00',
    is_night = false
WHERE start_time = '14:30'
  AND end_time = '08:00'
  AND is_evening = true;

\echo '=== ما تبقى من صفوف 14:30 (يجب أن تنتهي كلها 20:00) ==='
SELECT schedule_id, day_of_week, start_time::text, end_time::text, is_evening, is_night
FROM work_schedule_days
WHERE start_time = '14:30'
ORDER BY schedule_id, day_of_week;

\echo '=== دوام مسلم عقيل بعد التصحيح ==='
SELECT day_of_week, is_rest_day, start_time::text, end_time::text
FROM work_schedule_days
WHERE schedule_id = 'dfde4ad5-b343-4a62-9dcd-5efdee625f2b'
ORDER BY day_of_week;
