SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee IN ('anon', 'authenticated', 'public');
