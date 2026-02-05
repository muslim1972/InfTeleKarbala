-- ==================================================
-- إضافة أعمدة التدقيق (Audit Columns)
-- لتتبع من قام بالتعديل ومتى
-- ==================================================

-- 1. جدول السجلات المالية (financial_records)
alter table public.financial_records
add column if not exists last_modified_by uuid references public.app_users(id) on delete set null,
add column if not exists last_modified_by_name text,
add column if not exists last_modified_at timestamp with time zone default timezone('utc'::text, now());

-- 2. جدول الملخص الإداري (administrative_summary)
alter table public.administrative_summary
add column if not exists last_modified_by uuid references public.app_users(id) on delete set null,
add column if not exists last_modified_by_name text,
add column if not exists last_modified_at timestamp with time zone default timezone('utc'::text, now());

-- 3. جدول السجلات السنوية (yearly_records)
alter table public.yearly_records
add column if not exists last_modified_by uuid references public.app_users(id) on delete set null,
add column if not exists last_modified_by_name text,
add column if not exists last_modified_at timestamp with time zone default timezone('utc'::text, now());

-- 4. تسهيل الاستعلام (Optional Indexes)
create index if not exists idx_financial_mod_by on public.financial_records(last_modified_by);
