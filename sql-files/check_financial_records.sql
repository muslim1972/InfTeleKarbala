-- Check what records exist in financial_records for the user who just submitted the request
SELECT count(*) as financial_records_count 
FROM public.financial_records 
WHERE user_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d';

-- Also check if the ID concept is somehow different (e.g. employee_id vs user_id)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'financial_records' AND table_schema = 'public';
