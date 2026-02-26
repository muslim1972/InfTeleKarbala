-- تحديث نسبة ومخصصات الدكتوراه إلى 150%
-- يتم حساب المخصصات بناءً على الراتب الاسمي * 1.50
UPDATE financial_records
SET certificate_percentage = 150,
    certificate_allowance = ROUND(nominal_salary * 1.50)
WHERE certificate_text LIKE '%دكتوراه%';

-- تحديث نسبة ومخصصات الماجستير إلى 125%
-- يتم حساب المخصصات بناءً على الراتب الاسمي * 1.25
UPDATE financial_records
SET certificate_percentage = 125,
    certificate_allowance = ROUND(nominal_salary * 1.25) -- 125/100 = 1.25
WHERE certificate_text LIKE '%ماجستير%';

-- (اختياري) يمكنك التحقق من النتائج بعد التحديث باستخدام:
-- SELECT id, nominal_salary, certificate_text, certificate_percentage, certificate_allowance FROM financial_records WHERE certificate_text LIKE '%دكتوراه%' OR certificate_text LIKE '%ماجستير%';
