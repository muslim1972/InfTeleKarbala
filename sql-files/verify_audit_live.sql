-- ==================================================
-- فحص حي ومباشر لنظام التدقيق (Live Verification)
-- ==================================================

-- 1. تنظيف سياسات (RLS) القديمة لضمان عدم وجود منع
drop policy if exists "Allow view field history for authenticated users" on public.field_change_logs;
drop policy if exists "Allow insert for triggers" on public.field_change_logs;
drop policy if exists "Allow all" on public.field_change_logs;

-- فتح الجدول للجميع مؤقتاً للتأكد (Debugging Mode)
create policy "Allow all"
on public.field_change_logs
for all
to public
using (true)
with check (true);

-- 2. إدخال بيانات تجريبية (مستخدم وهمي)
do $$
declare
    new_user_id uuid;
    fin_record_id uuid;
begin
    -- حذف المستخدم التجريبي السابق إن وجد
    delete from public.app_users where username = 'audit_test_user';
    
    -- إضافة مستخدم
    insert into public.app_users (full_name, job_number, username, password, role)
    values ('مستخدم اختبار التدقيق', '999999', 'audit_test_user', '123456', 'user')
    returning id into new_user_id;

    -- إضافة سجل مالي
    insert into public.financial_records (user_id, nominal_salary, job_title)
    values (new_user_id, 500000, 'موظف تجريبي')
    returning id into fin_record_id;

    -- 3. إجراء تحديث (Update) - هذا يجب أن يفعل التريغر
    update public.financial_records
    set 
        nominal_salary = 600000, -- تغيير الراتب
        last_modified_by = new_user_id,
        last_modified_by_name = 'Audit Agent'
    where id = fin_record_id;

    -- 4. إجراء تحديث على المستخدم (App Users)
    update public.app_users
    set
        full_name = 'مستخدم اختبار التدقيق المعدل',
        last_modified_by = new_user_id,
        last_modified_by_name = 'Audit Agent'
    where id = new_user_id;

end $$;

-- 5. عرض النتائج: هل تم تسجيل التغيير؟
select 
    count(*) as logs_count,
    case when count(*) > 0 then 'SUCCESS: Triggers are working' else 'FAILURE: No logs created' end as status
from public.field_change_logs
where changed_by_name = 'Audit Agent';

-- عرض السجلات التفصيلية
select * from public.field_change_logs where changed_by_name = 'Audit Agent';
