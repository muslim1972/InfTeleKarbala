DO $$
DECLARE
    r RECORD;
    cnt INT;
BEGIN
    FOR r IN (
        SELECT table_schema, table_name, column_name 
        FROM information_schema.columns 
        WHERE data_type IN ('text', 'character varying', 'character')
          AND table_schema = 'public'
    ) LOOP
        BEGIN
            EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I LIKE ''%%صالح%%عبود%%''', 
                           r.table_schema, r.table_name, r.column_name) INTO cnt;
            IF cnt > 0 THEN
                RAISE NOTICE 'FOUND IN %.% (%) : % rows', r.table_schema, r.table_name, r.column_name, cnt;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;
