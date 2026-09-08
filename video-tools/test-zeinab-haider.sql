-- uid زينب (القسم مباشرة)
SELECT job_number, full_name, id, department_id
FROM public.profiles WHERE job_number = '102515291';

-- محاكاة زينب: ترى قسمها (القسم مباشرة) فقط
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"5f7b48f2-7ae6-4914-a251-41732d6ad713","role":"authenticated"}';
SELECT 'zeinab_dept' AS test, id, parent_id FROM public.departments
WHERE id = '33333333-2222-2222-2222-222222222222';
SELECT 'zeinab_visible' AS test, count(*) AS val FROM public.departments;
ROLLBACK;

-- محاكاة حيدر (قسم خارجي 55555555): يرى قسمه فقط، وليس أقسام التجهيز
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"ee8bdbb9-2e58-4dff-acfa-6977d7c67bff","role":"authenticated"}';
SELECT 'haider_visible' AS test, count(*) AS val FROM public.departments;
SELECT 'haider_sees_capacities' AS test, count(*) AS val FROM public.departments
WHERE id IN ('33333333-2222-2222-2222-222222222222','f7b97974-c251-4eb9-b91f-4143ba08a38c');
ROLLBACK;
