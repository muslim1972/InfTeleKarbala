SELECT certificate_text, certificate_percentage, COUNT(*) 
FROM financial_records 
GROUP BY certificate_text, certificate_percentage 
ORDER BY count DESC;
