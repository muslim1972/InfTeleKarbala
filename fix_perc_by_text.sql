BEGIN;
UPDATE financial_records
SET certificate_percentage = 
    CASE 
        WHEN certificate_text LIKE '%دكتوراه%' THEN 150
        WHEN certificate_text LIKE '%ماجستير%' THEN 125
        WHEN certificate_text LIKE '%دبلوم عالي%' THEN 55
        WHEN certificate_text LIKE '%بكلوريوس%' OR certificate_text LIKE '%بكالوريوس%' THEN 45
        WHEN certificate_text LIKE '%دبلوم%' AND certificate_text NOT LIKE '%عالي%' THEN 35
        WHEN certificate_text LIKE '%الاعدادية%' THEN 25
        WHEN certificate_text LIKE '%المتوسطة%' OR certificate_text LIKE '%الابتدائية%' OR certificate_text LIKE '%يقرأ ويكتب%' OR certificate_text LIKE '%أمي%' THEN 15
        ELSE 0
    END;
COMMIT;
