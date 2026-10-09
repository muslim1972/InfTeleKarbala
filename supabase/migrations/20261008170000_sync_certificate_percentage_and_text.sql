-- Migration: 20261008170000_sync_certificate_percentage_and_text.sql
-- Description: مزامنة وتصحيح نسب الشهادات ومسمياتها في جدول financial_records
-- 1. ملء certificate_percentage عندما تكون NULL (أو 0 ولديه مخصصات أو مسمى شهادة) حسب جدول النسب
-- 2. تصحيح certificate_text ليتطابق تماماً مع النسبة المحددة في certificate_percentage

-- المرحلة الأولى: ملء النسبة من مسمى الشهادة عند غياب النسبة
UPDATE financial_records
SET certificate_percentage = CASE
    WHEN certificate_text LIKE '%دكتوراه%' THEN 150
    WHEN certificate_text LIKE '%ماجستير%' THEN 125
    WHEN certificate_text LIKE '%دبلوم%عالي%' OR certificate_text LIKE '%دبلو%م%عالي%' THEN 55
    WHEN certificate_text LIKE '%ك%لوريوس%' THEN 45
    WHEN certificate_text LIKE '%دبلوم%' OR certificate_text LIKE '%معهد%' THEN 35
    WHEN certificate_text LIKE '%عدادي%' THEN 25
    WHEN certificate_text LIKE '%توسط%' OR certificate_text LIKE '%بتدائ%' OR certificate_text LIKE '%دون%' OR certificate_text LIKE '%أمي%' OR certificate_text LIKE '%امي%' OR certificate_text LIKE '%يقرأ%' THEN 15
    ELSE certificate_percentage
END
WHERE certificate_percentage IS NULL
   OR (certificate_percentage = 0 AND (
       (certificate_allowance IS NOT NULL AND certificate_allowance > 0)
       OR (certificate_text IS NOT NULL AND TRIM(certificate_text) NOT IN ('', 'بلا', 'بدون'))
   ));

-- المرحلة الثانية: تصحيح وتوحيد مسمى الشهادة وفق النسبة المستحقة
-- نسبة 150 -> دكتوراه
UPDATE financial_records
SET certificate_text = 'دكتوراه'
WHERE certificate_percentage = 150
  AND (certificate_text IS NULL OR certificate_text != 'دكتوراه');

-- نسبة 125 -> ماجستير
UPDATE financial_records
SET certificate_text = 'ماجستير'
WHERE certificate_percentage = 125
  AND (certificate_text IS NULL OR certificate_text != 'ماجستير');

-- نسبة 55 -> دبلوم عالي
UPDATE financial_records
SET certificate_text = 'دبلوم عالي'
WHERE certificate_percentage = 55
  AND (certificate_text IS NULL OR certificate_text != 'دبلوم عالي');

-- نسبة 45 -> بكالوريوس (إذا لم تكن بكالوريوس أو بكلوريوس)
UPDATE financial_records
SET certificate_text = 'بكالوريوس'
WHERE certificate_percentage = 45
  AND (certificate_text IS NULL OR certificate_text NOT IN ('بكالوريوس', 'بكلوريوس'));

-- نسبة 35 -> دبلوم (تصحيح أي مسمى خاطئ مثل دبلوم عالي إلى دبلوم)
UPDATE financial_records
SET certificate_text = 'دبلوم'
WHERE certificate_percentage = 35
  AND (certificate_text IS NULL OR certificate_text != 'دبلوم');

-- نسبة 25 -> الاعدادية
UPDATE financial_records
SET certificate_text = 'الاعدادية'
WHERE certificate_percentage = 25
  AND (certificate_text IS NULL OR certificate_text != 'الاعدادية');

-- نسبة 15 -> تنظيف النصوص المركبة التي تحوي شوائب
UPDATE financial_records
SET certificate_text = 'الابتدائية'
WHERE certificate_percentage = 15
  AND certificate_text LIKE '%ابتدائ%';

UPDATE financial_records
SET certificate_text = 'المتوسطة'
WHERE certificate_percentage = 15
  AND certificate_text LIKE '%توسط%';
