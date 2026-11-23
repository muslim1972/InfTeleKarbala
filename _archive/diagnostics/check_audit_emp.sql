SELECT 
    p.full_name,
    p.job_number,
    f.certificate_text,
    f.certificate_percentage,
    f.nominal_salary,
    f.certificate_allowance,
    f.job_title
FROM financial_records f
JOIN profiles p ON p.id = f.user_id
WHERE p.full_name LIKE '%ابراهيم سعدي%'
   OR p.full_name LIKE '%ابراهيم عزيز%'
   OR p.full_name LIKE '%احمد حسين لايذ%'
   OR p.full_name LIKE '%احمد عبد الرضا%'
   OR p.full_name LIKE '%مسلم عقيل%'
   OR p.full_name LIKE '%مهاد صاحب%'
   OR p.full_name LIKE '%علي عبد الحسين عبد الله%'
LIMIT 10;
