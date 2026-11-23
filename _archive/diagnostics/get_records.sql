SELECT column_name FROM information_schema.columns WHERE table_name = 'financial_records' AND (column_name LIKE '%mar%' OR column_name LIKE '%soc%' OR column_name LIKE '%stat%');
