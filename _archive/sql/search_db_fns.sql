SELECT proname 
FROM pg_proc 
WHERE prosrc ILIKE '%خروج مبكر%' OR prosrc ILIKE '%خفر%' OR prosrc ILIKE '%إجازة اعتيادية إجبارية%' OR prosrc ILIKE '%إجازة إجبارية%';
