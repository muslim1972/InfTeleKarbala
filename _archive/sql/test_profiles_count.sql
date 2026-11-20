SELECT 
    COUNT(*) as total_active_profiles,
    COUNT(*) FILTER (WHERE is_retired IS TRUE) as retired_profiles
FROM profiles 
WHERE governorate = 'karbala';
