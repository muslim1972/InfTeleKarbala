-- ==================================================
-- اصلاح صلاحيات جدول السجلات (Fix History RLS)
-- ==================================================

-- 1. تفعيل RLS على جدول field_change_logs
alter table public.field_change_logs enable row level security;

-- 2. سياسة العرض (SELECT): السماح للمستخدمين المسجلين برؤية السجلات
create policy "Allow view field history for authenticated users"
on public.field_change_logs
for select
to authenticated
using (true);

-- 3. سياسة الإضافة (INSERT): 
-- بما أن الإضافة تتم عبر Trigger، سنقوم بتحديث دالة التريغر لتكون SECURITY DEFINER.
-- هذا يعني أنها ستعمل بصلاحيات منشئ الدالة (Admin) وتتجاوز RLS عند الكتابة.
-- هذا أفضل أمنياً (المستخدم لا يستطيع تزوير السجلات يدوياً).

create or replace function public.log_field_changes()
returns trigger 
security definer -- <--- إضافة هامة
as $$
declare
    col_name text;
    old_val text;
    new_val text;
    modifier_id uuid;
    modifier_name text;
begin
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    if modifier_id is null then
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
