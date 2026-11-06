SELECT id, length(job_number) as len_job, quote_literal(job_number) as quoted_job, full_name 
FROM profiles 
WHERE id = '88ecc6c9-4a46-450d-9a98-bba47118c5df';
