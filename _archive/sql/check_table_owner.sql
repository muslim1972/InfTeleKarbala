SELECT tableowner FROM pg_tables WHERE tablename = 'monthly_snapshots';
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'monthly_snapshots';
