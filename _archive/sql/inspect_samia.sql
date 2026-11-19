SELECT p.id, p.job_number, p.full_name, f.certificate_text, f.certificate_percentage, f.nominal_salary, f.certificate_allowance
FROM financial_records f
JOIN profiles p ON p.id = f.user_id
WHERE p.job_number = '103129640';
