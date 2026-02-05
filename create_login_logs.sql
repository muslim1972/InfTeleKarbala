-- ==================================================
-- إنشاء جدول سجلات دخول المستخدمين (Login Logs)
-- ==================================================

create table if not exists public.login_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.app_users(id) on delete set null,
    full_name text,
    role text,
    login_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_agent text -- لتسجيل نوع المتصفح أو الجهاز (اختياري)
);

-- ==================================================
-- سياسات الأمان (RLS)
-- ==================================================

alter table public.login_logs enable row level security;

-- السماح بإضافة السجلات (مفتوح للجميع ليتمكن التطبيق من التسجيل)
create policy "Allow insert for all"
on public.login_logs for insert
with check (true);

-- السماح بالقراءة (يمكن تخصيصها للمشرفين فقط لاحقاً)
create policy "Allow read for all"
on public.login_logs for select
using (true);

-- ==================================================
-- الفهارس (Indexes)
-- ==================================================

create index if not exists idx_login_logs_user_id on public.login_logs(user_id);
create index if not exists idx_login_logs_login_at on public.login_logs(login_at);
