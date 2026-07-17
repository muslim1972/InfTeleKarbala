SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
