CREATE TABLE IF NOT EXISTS official_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE official_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to everyone" ON official_holidays;
CREATE POLICY "Allow read access to everyone" ON official_holidays FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all access to admin" ON official_holidays;
CREATE POLICY "Allow all access to admin" ON official_holidays FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.admin_role IN ('developer', 'general', 'hr')
    )
);

CREATE TABLE IF NOT EXISTS attendance_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    work_days JSONB DEFAULT '["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]'::jsonb,
    weekend_days JSONB DEFAULT '["Friday", "Saturday"]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO attendance_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to everyone" ON attendance_settings;
CREATE POLICY "Allow read access to everyone" ON attendance_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all access to admin" ON attendance_settings;
CREATE POLICY "Allow all access to admin" ON attendance_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.admin_role IN ('developer', 'general', 'hr')
    )
);
