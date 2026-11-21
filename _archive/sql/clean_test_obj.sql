SELECT name, bucket_id, created_at FROM storage.objects WHERE bucket_id = 'attendance-snapshots' AND name = 'test_policy_check.webp';
DELETE FROM storage.objects WHERE bucket_id = 'attendance-snapshots' AND name = 'test_policy_check.webp';
