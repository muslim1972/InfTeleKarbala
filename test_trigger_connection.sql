-- ==================================================
-- اختبار اتصال التريغر (Trigger Connection Test)
-- ==================================================
-- سنقوم بتعديل الدالة لترمي "خطأ متعمد" لإثبات أنها تعمل.

create or replace function public.log_field_changes()
returns trigger 
security definer
as $$
begin
    -- هذا الخطأ مقصود! سيظهر لك في واجهة التطبيق
    raise exception 'تم الاتصال بنجاح: التريغر يعمل! (Old: %, New: %)', (to_jsonb(OLD) ->> 'job_number'), (to_jsonb(NEW) ->> 'job_number');
    return NEW;
end;
$$ language plpgsql;
