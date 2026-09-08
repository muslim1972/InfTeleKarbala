SELECT pg_get_functiondef(oid) AS def
FROM pg_proc WHERE proname = 'get_login_profile';

-- بريد رسل في auth.users مباشرة
SELECT id, email FROM auth.users WHERE id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d';
