SELECT 
    COUNT(*) as total_profiles,
    COUNT(last_login_at) as has_last_login_at,
    MAX(last_login_at) as newest_profile_login
FROM profiles;
