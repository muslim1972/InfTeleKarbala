-- Migration: Add audit tracking to profiles table

-- 1. Add missing audit columns to profiles table
alter table public.profiles 
add column if not exists last_modified_by uuid,
add column if not exists last_modified_by_name text,
add column if not exists last_modified_at timestamp with time zone;

-- 2. Ensure trigger function exists (it should, but safety first)
-- The log_field_changes function is already used by other tables.

-- 3. Create trigger on profiles table
drop trigger if exists trg_audit_profiles on public.profiles;

create trigger trg_audit_profiles
after update on public.profiles
for each row
execute function public.log_field_changes();

-- Output success message
do $$
begin
  raise notice 'Successfully added audit triggers and columns to profiles table.';
end $$;
