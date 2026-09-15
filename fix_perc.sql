BEGIN;
UPDATE financial_records
SET certificate_percentage = ROUND((certificate_allowance / nominal_salary) * 100)
WHERE (certificate_percentage IS NULL OR certificate_percentage = 0)
  AND nominal_salary > 0 
  AND certificate_allowance > 0;
COMMIT;
