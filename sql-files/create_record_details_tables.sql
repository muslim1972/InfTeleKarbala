-- إنشاء جدول تفاصيل كتب الشكر
CREATE TABLE IF NOT EXISTS public.thanks_details (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    year INTEGER NOT NULL,
    book_number TEXT,
    book_date TEXT,
    reason TEXT,
    issuer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_modified_by UUID NULL,
    last_modified_by_name TEXT NULL,
    last_modified_at TIMESTAMPTZ NULL DEFAULT timezone('utc', now()),
    CONSTRAINT thanks_details_pkey PRIMARY KEY (id),
    CONSTRAINT thanks_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_thanks_details_user_year ON public.thanks_details USING btree (user_id, year);

-- إنشاء جدول تفاصيل اللجان
CREATE TABLE IF NOT EXISTS public.committees_details (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    year INTEGER NOT NULL,
    committee_name TEXT,
    role TEXT,
    start_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_modified_by UUID NULL,
    last_modified_by_name TEXT NULL,
    last_modified_at TIMESTAMPTZ NULL DEFAULT timezone('utc', now()),
    CONSTRAINT committees_details_pkey PRIMARY KEY (id),
    CONSTRAINT committees_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_committees_details_user_year ON public.committees_details USING btree (user_id, year);

-- تمكين RLS
ALTER TABLE public.thanks_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees_details ENABLE ROW LEVEL SECURITY;

-- سياسات RLS - القراءة والكتابة للمشرفين
CREATE POLICY "Admin full access thanks" ON public.thanks_details
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admin full access committees" ON public.committees_details
    FOR ALL USING (true) WITH CHECK (true);

-- Audit triggers
CREATE TRIGGER trg_audit_thanks
    AFTER UPDATE ON thanks_details
    FOR EACH ROW EXECUTE FUNCTION log_field_changes();

CREATE TRIGGER trg_audit_committees
    AFTER UPDATE ON committees_details
    FOR EACH ROW EXECUTE FUNCTION log_field_changes();
