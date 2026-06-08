-- هذا الأمر يخبر لوحة تحكم Supabase أن هذا الـ View يعتمد على صلاحيات المستخدم
-- وهو ما سيزيل علامة UNRESTRICTED الحمراء من لوحة التحكم
ALTER VIEW available_profiles SET (security_invoker = true);
