-- ==================================================
-- إعادة بناء نظام التدقيق بالكامل (Rebuild Audit System)
-- ==================================================
-- الهدف: حل مشكلة عدم ظهور السجلات بإزالة كافة القيود المعقدة وإعادة إنشاء التريغر.

-- 1. حذف الجدول القديم (لإعادة إنشائه بدون قيود FK صارمة)
drop table if exists public.field_change_logs cascade;

-- 2. إنشاء الجدول (بدون FK على changed_by لتجنب أخطاء المفاتيح)
create table public.field_change_logs (
    id uuid default gen_random_uuid() primary key,
    table_name text not null,
    record_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_by uuid, -- تم إزالة الـ references لتجنب الفشل الصامت
    changed_by_name text,
    changed_at timestamp with time zone default timezone('utc'::text, now())
);

-- تسريع البحث
create index idx_field_logs_record on public.field_change_logs(table_name, record_id, field_name);
create index idx_field_logs_changed_at on public.field_change_logs(changed_at);

-- تفعيل RLS (مع سماح للجميع مؤقتاً للتأكد)
alter table public.field_change_logs enable row level security;

create policy "Allow view field history for authenticated users"
on public.field_change_logs for select to authenticated using (true);

create policy "Allow insert for triggers"
on public.field_change_logs for insert to public with check (true);

-- 3. دالة التسجيل (محدثة وشاملة)
create or replace function public.log_field_changes()
returns trigger 
security definer -- يعمل بصلاحيات الأدمن
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
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    -- إذا كان فارغاً، نحاول الاستعانة بالـ Auth المباشر
    if modifier_id is null then
        modifier_id := auth.uid(); 
        modifier_name := 'System/Auth'; 
    end if;

    -- الدوران على الحقول
    for col_name in select key from jsonb_each(to_jsonb(NEW))
    loop
        -- استثناء حقول التتبع
        if col_name in ('last_modified_by', 'last_modified_by_name', 'last_modified_at', 'updated_at', 'created_at') then
            continue;
        end if;

        old_val := (to_jsonb(OLD) ->> col_name);
        new_val := (to_jsonb(NEW) ->> col_name);

        -- تسجيل التغيير إذا القيم مختلفة
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

-- 4. إعادة ربط التريغرز (Triggers) - للتأكد من وجودها
drop trigger if exists trg_audit_financial on public.financial_records;
create trigger trg_audit_financial
after update on public.financial_records
for each row execute function public.log_field_changes();

drop trigger if exists trg_audit_admin_summary on public.administrative_summary;
create trigger trg_audit_admin_summary
after update on public.administrative_summary
for each row execute function public.log_field_changes();

drop trigger if exists trg_audit_yearly on public.yearly_records;
create trigger trg_audit_yearly
after update on public.yearly_records
for each row execute function public.log_field_changes();
