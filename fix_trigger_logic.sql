-- ==================================================
-- تحديث دالة التريغر لقبول المعدل المجهول (Debug Fix)
-- ==================================================

create or replace function public.log_field_changes()
returns trigger 
security definer
as $$
declare
    col_name text;
    old_val text;
    new_val text;
    modifier_id uuid;
    modifier_name text;
begin
    -- محاولة الحصول على المعرف
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    -- إذا كان المعدل غير موجود، نحاول جلبه من مصادقة Supabase
    if modifier_id is null then
        modifier_id := auth.uid();
        modifier_name := 'User (Auth)';
    end if;

    -- إذا ظل فارغاً، لا نوقف العملية بل نسجل كمجهول (لأغراض التتبع)
    -- ملاحظة: حقل changed_by يقبل null
    
    for col_name in select key from jsonb_each(to_jsonb(NEW))
    loop
        -- تجاهل أعمدة التتبع
        if col_name = 'last_modified_by' or col_name = 'last_modified_by_name' or col_name = 'last_modified_at' or col_name = 'updated_at' then
            continue;
        end if;

        old_val := (to_jsonb(OLD) ->> col_name);
        new_val := (to_jsonb(NEW) ->> col_name);

        -- مقارنة القيم
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
                modifier_id, -- يمكن أن يكون null
                modifier_name,
                now()
            );
        end if;
    end loop;

    return NEW;
end;
$$ language plpgsql;

-- التحقق من عدد السجلات الحالي
select count(*) as current_log_count from public.field_change_logs;
