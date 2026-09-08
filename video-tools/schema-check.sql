-- قائمة الجداول المتبقية
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename OFFSET 57;

-- بنية profiles
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position;

-- بنية financial_records
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_records' ORDER BY ordinal_position;

-- بنية incentive_point_values
SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='incentive_point_values' ORDER BY ordinal_position;

-- عدد الصفوف الحالية
SELECT 'profiles' AS t, count(*) FROM public.profiles
UNION ALL SELECT 'financial_records', count(*) FROM public.financial_records;

-- فحص وجود جداول نسخ سابقة (احتياطي)
SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename ILIKE '%snapshot%' OR tablename ILIKE '%version%' OR tablename ILIKE '%archive%' OR tablename ILIKE '%history%' OR tablename ILIKE '%monthly%');
