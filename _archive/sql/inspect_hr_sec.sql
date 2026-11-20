SELECT section_text, count(*) 
FROM profiles 
WHERE governorate = 'karbala' AND section_text ILIKE '%موارد%'
GROUP BY section_text;