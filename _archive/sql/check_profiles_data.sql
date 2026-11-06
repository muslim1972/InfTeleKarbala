SELECT job_number, full_name, username, phone_number, birth_date, updated_at
FROM profiles
WHERE job_number LIKE '9999%'
ORDER BY job_number
LIMIT 10;
