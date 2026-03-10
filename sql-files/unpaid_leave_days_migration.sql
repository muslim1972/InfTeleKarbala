-- إضافة عمود أيام الإجازة بدون راتب
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS unpaid_days INTEGER DEFAULT 0;
