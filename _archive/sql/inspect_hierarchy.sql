SELECT 
    department, 
    division, 
    unit, 
    workplace, 
    COUNT(*) as count
FROM profiles
WHERE governorate = 'karbala' AND (is_retired IS FALSE OR is_retired IS NULL)
GROUP BY department, division, unit, workplace
ORDER BY count DESC
LIMIT 40;