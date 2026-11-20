SELECT DISTINCT 
  CASE 
    WHEN unit_text IS NOT NULL AND unit_text != '' THEN dept_text || ' / ' || section_text || ' / ' || unit_text
    WHEN section_text IS NOT NULL AND section_text != '' THEN dept_text || ' / ' || section_text
    ELSE dept_text
  END AS wp,
  LENGTH(
    CASE 
      WHEN unit_text IS NOT NULL AND unit_text != '' THEN dept_text || ' / ' || section_text || ' / ' || unit_text
      WHEN section_text IS NOT NULL AND section_text != '' THEN dept_text || ' / ' || section_text
      ELSE dept_text
    END
  ) AS len
FROM profiles 
WHERE dept_text IS NOT NULL
ORDER BY len DESC
LIMIT 5;
