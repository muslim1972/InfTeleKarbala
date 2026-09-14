SELECT full_name, job_title, salary_grade, salary_stage, tax_deduction_status, certificate_allowance, legal_allowance, nominal_salary, position_allowance, risk_allowance, updated_at
FROM financial_records 
WHERE full_name LIKE '%ابراهيم عبد الامير%' OR full_name LIKE '%علي عباس%';
