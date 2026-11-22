SELECT 
    f.full_name,
    p.job_number,
    f.job_title,
    f.certificate_text,
    f.nominal_salary,
    f.certificate_allowance,
    f.risk_allowance
FROM financial_records f
JOIN profiles p ON p.id = f.user_id
WHERE p.governorate = 'karbala'
  AND p.job_number LIKE '143264%'
LIMIT 10;
