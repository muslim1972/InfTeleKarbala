SELECT 
    dept_text, 
    section_text, 
    unit_text, 
    COUNT(*) as c 
FROM profiles 
WHERE governorate = 'karbala' AND (is_retired IS FALSE OR is_retired IS NULL)
GROUP BY dept_text, section_text, unit_text 
ORDER BY c DESC 
LIMIT 30;