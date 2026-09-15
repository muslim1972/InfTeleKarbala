SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financial_records' AND (column_name LIKE '%percent%' OR column_name LIKE '%perc%');
