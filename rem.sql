SELECT certificate_text, nominal_salary, certificate_allowance FROM financial_records WHERE certificate_percentage IS NULL OR certificate_percentage = 0 LIMIT 5;
