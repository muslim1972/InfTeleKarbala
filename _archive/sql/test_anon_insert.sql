SET ROLE anon;
DO 
BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('attendance-snapshots', 'test_policy_check.webp', NULL);
    
    DELETE FROM storage.objects WHERE bucket_id = 'attendance-snapshots' AND name = 'test_policy_check.webp';
    RAISE NOTICE 'SUCCESS: anon role can insert into attendance-snapshots!';
END ;
RESET ROLE;
