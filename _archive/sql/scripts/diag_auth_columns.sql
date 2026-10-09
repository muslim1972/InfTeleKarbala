SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='auth' AND table_name='identities' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns
WHERE table_schema='auth' AND table_name='users' AND is_nullable='NO' ORDER BY ordinal_position;
