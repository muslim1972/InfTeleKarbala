SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (column_name ILIKE '%password%' OR column_name ILIKE '%hash%' OR column_name ILIKE '%secret%');
