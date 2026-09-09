-- فحص بنية المحافظات والأدوار
SELECT 'profiles.governorate=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='governorate') THEN 'Y' ELSE 'N' END;
SELECT 'financial_records.governorate=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financial_records' AND column_name='governorate') THEN 'Y' ELSE 'N' END;
SELECT 'monthly_snapshots.governorate=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_snapshots' AND column_name='governorate') THEN 'Y' ELSE 'N' END;
SELECT 'snap_unique_idx=' || indexdef FROM pg_indexes WHERE tablename='monthly_snapshots';
SELECT 'role=' || COALESCE(admin_role,'NULL') || ' cnt=' || count(*) FROM profiles GROUP BY admin_role;
SELECT 'govvals=' || COALESCE(string_agg(DISTINCT COALESCE(governorate,'NULL'), ','), '-') FROM profiles;
