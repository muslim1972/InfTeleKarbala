SELECT p.full_name, p.job_number, f.certificate_text, f.certificate_percentage, f.certificate_allowance, f.nominal_salary
FROM profiles p
JOIN financial_records f ON f.user_id = p.id
WHERE p.full_name LIKE '%ابراهيم سعدي%' OR p.full_name LIKE '%بشير مرتضى%'
ORDER BY f.updated_at DESC LIMIT 5;
