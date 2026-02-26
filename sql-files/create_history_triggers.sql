-- ==================================================
-- إنشاء جدول سجل تغييرات الحقول (Field Audit Logs)
-- ==================================================
create table if not exists public.field_change_logs (
    id uuid default gen_random_uuid() primary key,
    table_name text not null,
    record_id uuid not null, -- ID of the record in the target table
    field_name text not null,
    old_value text,
    new_value text,
    changed_by uuid references public.app_users(id) on delete set null,
    changed_by_name text, -- Snapshot of name
    changed_at timestamp with time zone default timezone('utc'::text, now())
);

-- الفهارس
create index if not exists idx_field_logs_record on public.field_change_logs(table_name, record_id, field_name);
create index if not exists idx_field_logs_changed_at on public.field_change_logs(changed_at);

-- ==================================================
-- دالة التريغر العامة (Generic Trigger Function)
-- تقوم بمقارنة القيم القديمة والجديدة وتسجيل التغييرات
-- ==================================================
create or replace function public.log_field_changes()
returns trigger as $$
declare
    col_name text;
    old_val text;
    new_val text;
    modifier_id uuid;
    modifier_name text;
begin
    -- نفترض أن التطبيق يقوم بإرسال last_modified_by مع نص التحديث
    -- هذا العمود موجود في NEW
    modifier_id := NEW.last_modified_by;
    modifier_name := NEW.last_modified_by_name;

    -- إذا لم يكن هناك معدل معروف، لا نسجل (أو نسجل كـ System)
    -- هنا سنعتمد على أن التطبيق يرسل البيانات
    if modifier_id is null then
        return NEW;
    end if;

    -- الدوران على جميع الأعمدة
    -- ملاحظة: jsonb يسهل التعامل مع الحقول ديناميكياً
    for col_name in select key from jsonb_each(to_jsonb(NEW))
    loop
        -- تجاهل أعمدة التتبع نفسها
        if col_name = 'last_modified_by' or col_name = 'last_modified_by_name' or col_name = 'last_modified_at' or col_name = 'updated_at' then
            continue;
        end if;

        -- استخراج القيم كنص
        old_val := (to_jsonb(OLD) ->> col_name);
        new_val := (to_jsonb(NEW) ->> col_name);

        -- مقارنة القيم (مع معالجة NULL)
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
                NEW.id, -- نفترض أن المفتاح الأساسي اسمه id دائماً
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

-- ==================================================
-- ربط التريغر بالجداول
-- ==================================================

-- 1. financial_records
drop trigger if exists trg_audit_financial on public.financial_records;
create trigger trg_audit_financial
after update on public.financial_records
for each row execute function public.log_field_changes();

-- 2. administrative_summary
drop trigger if exists trg_audit_admin_summary on public.administrative_summary;
create trigger trg_audit_admin_summary
after update on public.administrative_summary
for each row execute function public.log_field_changes();

-- 3. yearly_records
drop trigger if exists trg_audit_yearly on public.yearly_records;
create trigger trg_audit_yearly
after update on public.yearly_records
for each row execute function public.log_field_changes();

-- 4. app_users (لتعيير الاسم والوظيفة وغيرها)
-- نحتاج لإضافة أعمدة التدقيق لجدول app_users أولاً لكي يعمل التريغر العام (لأنه يعتمد على last_modified_by)
-- إذا لم نضفها، سيفشل التريغر أو نحتاج لتعديل الدالة لتقبل الحالات التي لا يوجد فيها هذا العمود.
-- حالياً سنكتفي بالجداول المالية والإدارية حسب طلب المستخدم الأساسي "الاستقطاعات".
