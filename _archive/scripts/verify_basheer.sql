\echo '=== BASHEER NOTIFICATIONS ==='
SELECT id, recipient_id, sender_id, type, title, content, is_read, created_at, metadata 
FROM public.system_notifications 
WHERE recipient_id = '2a24e7bf-357a-4587-9461-8289dfe802dc'
ORDER BY created_at DESC LIMIT 3;
