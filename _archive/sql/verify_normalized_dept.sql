SELECT 
    dept_text, 
    section_text, 
    COUNT(*) as c 
FROM profiles 
WHERE governorate = 'karbala' AND (is_retired IS FALSE OR is_retired IS NULL)
GROUP BY dept_text, section_text 
ORDER BY dept_text, section_text;