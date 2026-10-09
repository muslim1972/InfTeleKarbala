-- فحص نتيجة السرد الإداري لجهاز متعدد المواقع (نسخة مُصحّحة — خارج معاملة التراجع)
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"2a24e7bf-357a-4587-9461-8289dfe802dc","role":"authenticated"}';

SELECT public.admin_create_kiosk_device(
  'كيوسك اختبار التعدد',
  ARRAY[(SELECT id FROM work_locations ORDER BY name LIMIT 1),
        (SELECT id FROM work_locations ORDER BY name DESC LIMIT 1)]
);

RESET role;
SELECT activation_code AS kcode FROM kiosk_devices WHERE name='كيوسك اختبار التعدد' ORDER BY created_at DESC LIMIT 1 \gset

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"2a24e7bf-357a-4587-9461-8289dfe802dc","role":"authenticated"}';

\echo '=== السرد الإداري: نفس الجهاز بموقعين ==='
SELECT dev->>'name' AS device,
       jsonb_array_length(dev->'locations') AS locs,
       (SELECT string_agg(l->>'name', ' / ') FROM jsonb_array_elements(dev->'locations') l) AS names
FROM jsonb_array_elements(public.admin_list_kiosk_devices()->'devices') dev
WHERE dev->>'name' = 'كيوسك اختبار التعدد';

ROLLBACK;
