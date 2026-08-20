SELECT table_name, column_name FROM information_schema.columns WHERE data_type IN ('text', 'jsonb', 'varchar', 'character varying');
