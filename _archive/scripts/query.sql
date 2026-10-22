\echo '=== LATEST REQUEST ==='
SELECT id, user_id, destination_entity, status, supervisor_id, created_at 
FROM public.service_continuity_requests 
ORDER BY created_at DESC LIMIT 1;

\echo '=== PROFILES FOR MUSLIM AND BASHEER ==='
SELECT id, full_name, username, department_id, role, admin_role 
FROM public.profiles 
WHERE full_name ILIKE '%مسلم%' OR full_name ILIKE '%بشير%' OR username ILIKE '%basheer%' OR username ILIKE '%bashir%';

\echo '=== APPROVAL CHAIN FOR MUSLIM ==='
SELECT * FROM public.core_resolve_approval_chain((SELECT id FROM public.profiles WHERE full_name ILIKE '%مسلم%' LIMIT 1));

\echo '=== LATEST SYSTEM NOTIFICATIONS ==='
SELECT id, user_id, title, message, type, is_read, created_at 
FROM public.system_notifications 
ORDER BY created_at DESC LIMIT 5;
