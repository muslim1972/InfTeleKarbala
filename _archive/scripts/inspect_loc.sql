\echo '=== PROFILES LOCATION/DEPT COLUMNS ==='
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND (column_name LIKE '%loc%' OR column_name LIKE '%work%' OR column_name LIKE '%dept%');

\echo '=== HOW NOTIFICATION CLEANUP WORKS IN LEAVES ==='
\df *cleanup*
\df *notification*
