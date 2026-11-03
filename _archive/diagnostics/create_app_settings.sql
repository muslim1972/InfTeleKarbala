CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow read app_settings'
    ) THEN
        CREATE POLICY "Allow read app_settings" ON public.app_settings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow write app_settings'
    ) THEN
        CREATE POLICY "Allow write app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
