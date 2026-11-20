SELECT 
    COUNT(*) as total_profiles,
    COUNT(last_login) as has_last_login,
    MAX(last_login) as newest_profile_login
FROM profiles;

SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT user_id) as users_with_logs,
    MAX(login_at) as newest_log
FROM login_logs;
