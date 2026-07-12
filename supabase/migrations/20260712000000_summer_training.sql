-- ==========================================
-- 1. Create summer_training_settings table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.summer_training_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_active BOOLEAN DEFAULT true,
    exam_duration_minutes INTEGER DEFAULT 60,
    passing_score INTEGER DEFAULT 50,
    total_questions INTEGER DEFAULT 100,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Insert default row for settings if empty
INSERT INTO public.summer_training_settings (exam_active, exam_duration_minutes)
SELECT true, 60
WHERE NOT EXISTS (SELECT 1 FROM public.summer_training_settings);

-- ==========================================
-- 2. Create summer_training_students table (Matching exactly your DB structure)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.summer_training_students (
  id uuid not null default gen_random_uuid (),
  full_name text not null,
  username text not null,
  password_hash text not null,
  institution_type text not null,
  institution_name text not null,
  department text not null,
  start_date date null,
  end_date date null,
  exam_grade text null,
  supervisor_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint summer_training_students_pkey primary key (id),
  constraint summer_training_students_username_key unique (username),
  constraint summer_training_students_supervisor_id_fkey foreign KEY (supervisor_id) references profiles (id),
  constraint summer_training_students_exam_grade_check check (
    (
      exam_grade = any (
        array[
          'excellent'::text,
          'very_good'::text,
          'good'::text,
          'acceptable'::text
        ]
      )
    )
  ),
  constraint summer_training_students_institution_type_check check (
    (
      institution_type = any (array['college'::text, 'school'::text])
    )
  )
) TABLESPACE pg_default;

-- ==========================================
-- 3. Create summer_training_results table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.summer_training_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.summer_training_students(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    duration_seconds INTEGER,
    exam_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 4. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.summer_training_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summer_training_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summer_training_results ENABLE ROW LEVEL SECURITY;

-- Policies for summer_training_settings
DROP POLICY IF EXISTS "Enable read access for all" ON public.summer_training_settings;
CREATE POLICY "Enable read access for all" ON public.summer_training_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update for auth" ON public.summer_training_settings;
CREATE POLICY "Enable update for auth" ON public.summer_training_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- Policies for summer_training_students
DROP POLICY IF EXISTS "Enable read access for auth and anon" ON public.summer_training_students;
CREATE POLICY "Enable read access for auth and anon" ON public.summer_training_students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all for auth" ON public.summer_training_students;
CREATE POLICY "Enable all for auth" ON public.summer_training_students FOR ALL USING (auth.role() = 'authenticated');

-- Policies for summer_training_results
DROP POLICY IF EXISTS "Enable insert for all" ON public.summer_training_results;
CREATE POLICY "Enable insert for all" ON public.summer_training_results FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for all" ON public.summer_training_results;
CREATE POLICY "Enable select for all" ON public.summer_training_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable delete for auth" ON public.summer_training_results;
CREATE POLICY "Enable delete for auth" ON public.summer_training_results FOR DELETE USING (auth.role() = 'authenticated');

-- ==========================================
-- 5. RPC Functions
-- ==========================================

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RPC for authenticate_training_student
DROP FUNCTION IF EXISTS public.authenticate_training_student(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.authenticate_training_student(p_username TEXT, p_password TEXT)
RETURNS SETOF public.summer_training_students AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.summer_training_students
    WHERE username = p_username 
      AND password_hash = crypt(p_password, password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for create_training_student
DROP FUNCTION IF EXISTS public.create_training_student(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID);
CREATE OR REPLACE FUNCTION public.create_training_student(
    p_full_name TEXT,
    p_username TEXT,
    p_password TEXT,
    p_institution_type TEXT,
    p_institution_name TEXT,
    p_department TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_supervisor_id UUID
) RETURNS void AS $$
BEGIN
    INSERT INTO public.summer_training_students (
        full_name,
        username,
        password_hash,
        institution_type,
        institution_name,
        department,
        start_date,
        end_date,
        supervisor_id
    ) VALUES (
        p_full_name,
        p_username,
        crypt(p_password, gen_salt('bf')),
        p_institution_type,
        p_institution_name,
        p_department,
        p_start_date,
        p_end_date,
        p_supervisor_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
