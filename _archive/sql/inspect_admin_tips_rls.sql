SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'admin_tips';

SELECT * FROM pg_policies WHERE tablename = 'admin_tips';
