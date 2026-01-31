-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  job_number text,
  avatar_url text, -- Optional
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. FINANCIAL RECORDS
create table public.financial_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  
  -- Job Info
  job_title text,
  salary_grade text,
  salary_stage text,
  
  -- Allowances & Deductions
  tax_deduction_status text,
  tax_deduction_amount numeric,
  certificate_allowance numeric,
  engineering_allowance numeric,
  legal_allowance numeric,
  transport_allowance numeric,
  marital_allowance numeric,
  children_allowance numeric,
  
  -- Deductions
  loan_deduction numeric,
  execution_deduction numeric,
  retirement_deduction numeric,
  school_stamp_deduction numeric,
  social_security_deduction numeric,
  other_deductions numeric,
  
  -- Summary
  certificate_text text,
  certificate_percentage numeric,
  position_allowance numeric,
  risk_allowance numeric,
  additional_50_percent_allowance numeric,
  
  total_deductions numeric,
  nominal_salary numeric,
  gross_salary numeric,
  net_salary numeric,
  iban text,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.financial_records enable row level security;
create policy "Users can view own financial records." on public.financial_records for select using (auth.uid() = user_id);

-- 3. ADMINISTRATIVE SUMMARY
create table public.administrative_summary (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  
  remaining_leave_balance integer,
  five_year_law_leaves integer,
  disengagement_date date,
  resumption_date date,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.administrative_summary enable row level security;
create policy "Users can view own admin summary." on public.administrative_summary for select using (auth.uid() = user_id);

-- 4. YEARLY RECORDS (Books, Penalties, Leaves)
create table public.yearly_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  year integer not null,
  
  thanks_books_count integer default 0,
  committees_count integer default 0,
  penalties_count integer default 0,
  leaves_taken integer default 0,
  sick_leaves integer default 0,
  unpaid_leaves integer default 0,
  
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.yearly_records enable row level security;
create policy "Users can view own yearly records." on public.yearly_records for select using (auth.uid() = user_id);
