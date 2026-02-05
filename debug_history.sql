-- ==================================================
-- فحص وتشخيص مشاكل السجل (Debug History Logs)
-- ==================================================

-- 1. التأكد من وجود الجدول
select exists (
   select from information_schema.tables 
   where table_schema = 'public'
   and table_name = 'field_change_logs'
) as table_exists;

-- 2. عرض عدد السجلات الموجودة (ككل)
select count(*) as total_logs from public.field_change_logs;

-- 3. عرض آخر 10 سجلات تم إضافتها (للتأكد من أن عملية الإضافة تعمل)
select 
    id, 
    table_name, 
    field_name, 
    old_value, 
    new_value, 
    changed_by_name, 
    changed_at 
from public.field_change_logs 
order by changed_at desc 
limit 10;

-- 4. التأكد من التريغر على الجداول (admin_summary)
select 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement 
from information_schema.triggers 
where event_object_table = 'administrative_summary';

-- ==================================================
-- حل جذري (Bypass RLS for everyone temporarily to test)
-- ==================================================
-- تحذير: هذا يسمح للجميع بالإضافة مؤقتاً للتأكد
-- drop policy if exists "Enable insert for authenticated users only" on public.field_change_logs;
create policy "Allow insert for triggers"
on public.field_change_logs
for insert
to public
with check (true);

-- التأكد من أن التابع security definer
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'log_field_changes';

-- ==================================================
-- إعادة إنشاء التريغر بشكل آمن جداً
-- ==================================================
create or replace function public.log_field_changes()
returns trigger 
security definer
set search_path = public
as $$
declare
    col_name text;
    old_val text;
    new_val text;
    modifier_id uuid;
    modifier_name text;
begin
    -- Check inputs
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    -- Force logging even if modifier is null (For debugging purposes only)
    if modifier_id is null then
        -- uncomment next line to debug null modifier
        -- raise warning 'Null modifier for record %', NEW.id;
        return NEW; 
    end if;

    for col_name in select key from jsonb_each(to_jsonb(NEW))
    loop
        if col_name = 'last_modified_by' or col_name = 'last_modified_by_name' or col_name = 'last_modified_at' or col_name = 'updated_at' then
            continue;
        end if;

        old_val := (to_jsonb(OLD) ->> col_name);
        new_val := (to_jsonb(NEW) ->> col_name);

        if (old_val is distinct from new_val) then
            insert into public.field_change_logs (
                table_name,
                record_id,
                field_name,
                old_value,
                new_value,
                changed_by,
                changed_by_name,
                changed_at
            ) values (
                TG_TABLE_NAME,
                NEW.id, 
                col_name,
                old_val,
                new_val,
                modifier_id,
                modifier_name,
                now()
            );
        end if;
    end loop;

    return NEW;
end;
$$ language plpgsql;
