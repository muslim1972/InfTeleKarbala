-- 1) RLS مفعل على departments؟
SELECT relname, relrowsecurity, relowner::regrole AS owner
FROM pg_class WHERE relname = 'departments';

-- 2) سياسات departments كلها
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'departments';

-- 3) شجرة القسم (id, parent_id, name, is_active?)
SELECT id, parent_id, name
FROM public.departments
WHERE id IN ('33333333-2222-2222-2222-222222222222',
             'f7b97974-c251-4eb9-b91f-4143ba08a38c');

-- 4) محاكاة استعلام الواجهة حرفياً (بصفتي postgres — للتحقق من البيانات فقط)
SELECT id, parent_id,
       (id = '33333333-2222-2222-2222-222222222222') AS is_self,
       (parent_id = '33333333-2222-2222-2222-222222222222') AS is_child
FROM public.departments
WHERE id = 'f7b97974-c251-4eb9-b91f-4143ba08a38c';
