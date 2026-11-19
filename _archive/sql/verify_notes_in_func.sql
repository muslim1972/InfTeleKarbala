SELECT prosrc LIKE '%يجب وضع غرض للكتاب%' AS has_validation 
FROM pg_proc 
WHERE proname = 'submit_service_continuity_request';
