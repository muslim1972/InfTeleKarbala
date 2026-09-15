SELECT p.job_number, f.created_at, f.updated_at FROM profiles p JOIN financial_records f ON p.id = f.user_id WHERE p.governorate = 'babil' LIMIT 5;
