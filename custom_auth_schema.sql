-- 1. DROP EXISTING TABLES (CLEAN SLATE)
-- Using CASCADE to remove foreign key dependencies automatically
DROP TABLE IF EXISTS public.yearly_records CASCADE;
DROP TABLE IF EXISTS public.administrative_summary CASCADE;
DROP TABLE IF EXISTS public.financial_records CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.app_users CASCADE;

-- 2. CREATE USERS TABLE (CUSTOM AUTH)
create table public.app_users (
  id uuid default uuid_generate_v4() primary key,
  username text unique not null,
  password text not null, -- Stores 6-digit password as text for now
  full_name text not null,
  job_number text, -- Added Job Number
  role text default 'user', -- 'admin', 'user'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. FINANCIAL RECORDS (Linked to app_users)
create table public.financial_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.app_users(id) not null,
  
  -- Job Info
  job_title text,
  salary_grade text,
  salary_stage text,
  
  -- Allowances & Deductions
  tax_deduction_status text,
  tax_deduction_amount numeric default 0,
  certificate_allowance numeric default 0,
  engineering_allowance numeric default 0,
  legal_allowance numeric default 0,
  transport_allowance numeric default 0,
  marital_allowance numeric default 0,
  children_allowance numeric default 0,
  
  -- Deductions
  loan_deduction numeric default 0,
  execution_deduction numeric default 0,
  retirement_deduction numeric default 0,
  school_stamp_deduction numeric default 0,
  social_security_deduction numeric default 0,
  other_deductions numeric default 0,
  
  -- Summary
  certificate_text text,
  certificate_percentage numeric default 0,
  position_allowance numeric default 0,
  risk_allowance numeric default 0,
  additional_50_percent_allowance numeric default 0,
  
  total_deductions numeric default 0,
  nominal_salary numeric default 0,
  gross_salary numeric default 0,
  net_salary numeric default 0,
  iban text,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. ADMINISTRATIVE SUMMARY (Linked to app_users)
create table public.administrative_summary (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.app_users(id) not null,
  
  remaining_leave_balance integer default 0,
  five_year_law_leaves integer default 0,
  disengagement_date date,
  resumption_date date,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. YEARLY RECORDS (Linked to app_users)
create table public.yearly_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.app_users(id) not null,
  year integer not null,
  
  thanks_books_count integer default 0,
  committees_count integer default 0,
  penalties_count integer default 0,
  leaves_taken integer default 0,
  sick_leaves integer default 0,
  unpaid_leaves integer default 0,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. DISABLE RLS FOR NOW
alter table public.app_users disable row level security;
alter table public.financial_records disable row level security;
alter table public.administrative_summary disable row level security;
alter table public.yearly_records disable row level security;

-- 7. INSERT TEST DATA (5 Users)
insert into public.app_users (username, password, full_name, job_number, role) values
('user1', '123456', 'احمد محمد علي', '10024', 'user'),
('user2', '123456', 'سارة حسن حسين', '10025', 'user'),
('user3', '123456', 'علي كاظم جاسم', '10026', 'user'),
('user4', '123456', 'مريم عباس فاضل', '10027', 'user'),
('user5', '654321', 'مدير النظام', '99999', 'admin');

-- Insert Dummy Financial Data for User1
insert into public.financial_records (user_id, nominal_salary, gross_salary, net_salary, job_title) 
select id, 850000, 1200000, 1150000, 'مهندس اقدم' from public.app_users where username = 'user1';
