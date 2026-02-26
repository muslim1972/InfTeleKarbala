-- ==================================================
-- استعادة التريغر للعمل (Restore Audit Trigger)
-- ==================================================
-- بعد التأكد من أن التريغر متصل، نعيده الآن ليقوم بالحفظ بدلاً من إظهار الخطأ.

create or replace function public.log_field_changes()
returns trigger 
security definer -- يعمل بصلاحيات الأدمن (يتجاوز مشاكل الصلاحيات)
set search_path = public
as $$
declare
    col_name text;
    old_val text;
    new_val text;
    modifier_id uuid;
    modifier_name text;
begin
    -- محاولة جلب المعرف من البيانات المرسلة
    -- (الواجهة ترسل هذه البيانات في last_modified_by)
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    -- إذا كان فارغاً (مثلاً تحديث من مكان آخر)، نحاول الاستعانة بالـ Auth المباشر
    if modifier_id is null then
        modifier_id := auth.uid(); 
        modifier_name := 'System/Auth'; 
    end if;

    -- الدوران على جميع الحقول في السجل المعدل
    for col_name in select key from jsonb_each(to_jsonb(NEW))
    loop
        -- استثناء حقول التتبع لكي لا نسجل تغييرها (لأنها تتغير دائماً مع أي تحديث)
        if col_name in ('last_modified_by', 'last_modified_by_name', 'last_modified_at', 'updated_at', 'created_at', 'password') then
            continue;
        end if;

        old_val := (to_jsonb(OLD) ->> col_name);
        new_val := (to_jsonb(NEW) ->> col_name);

        -- تسجيل التغيير فقط إذا كانت القيمة مختلفة (وليست فارغة في الحالتين)
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
