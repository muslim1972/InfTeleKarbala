-- ==================================================
-- تفعيل سجل التغييرات لجدول المستخدمين (app_users)
-- ==================================================

-- 1. إضافة أعمدة التتبع لجدول app_users (إذا لم تكن موجودة)
alter table public.app_users 
add column if not exists last_modified_by uuid references public.app_users(id),
add column if not exists last_modified_by_name text,
add column if not exists last_modified_at timestamp with time zone;

-- 2. إضافة التريغر لجدول app_users
drop trigger if exists trg_audit_app_users on public.app_users;

create trigger trg_audit_app_users
after update on public.app_users
for each row execute function public.log_field_changes();

-- 3. تفعيل RLS للتأكد (اختياري لكن مفضل)
alter table public.app_users enable row level security;

-- السماح للجميع بالقراءة (أو حسب سياستك الحالية)
create policy "Allow read access for authenticated users"
on public.app_users for select to authenticated using (true);
-- (ملاحظة: السياسات الأخرى قد تكون موجودة بالفعل، لا نحذفها)
