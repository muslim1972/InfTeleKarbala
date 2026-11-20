SELECT 'profiles' as tbl, id::text, full_name FROM profiles WHERE full_name LIKE '%صالح%عبود%' OR full_name LIKE '%صالح%عبد%الحسن%';
SELECT 'available_profiles' as tbl, id::text, full_name FROM available_profiles WHERE full_name LIKE '%صالح%عبود%' OR full_name LIKE '%صالح%عبد%الحسن%';
SELECT 'financial_records' as tbl, id::text, full_name FROM financial_records WHERE full_name LIKE '%صالح%عبود%' OR full_name LIKE '%صالح%عبد%الحسن%';
SELECT 'login_logs' as tbl, id::text, full_name FROM login_logs WHERE full_name LIKE '%صالح%عبود%' OR full_name LIKE '%صالح%عبد%الحسن%';
