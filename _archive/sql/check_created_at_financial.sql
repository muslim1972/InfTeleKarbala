SELECT fr.id, fr.user_id, p.full_name, p.job_number, fr.updated_at, fr.gross_salary, fr.job_title
FROM financial_records fr
JOIN profiles p ON p.id = fr.user_id
WHERE p.job_number LIKE '9999%'
ORDER BY p.job_number;
