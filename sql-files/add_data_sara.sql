-- Add dummy data for User 2 (Sara) so the dashboard isn't empty
insert into public.financial_records (
  user_id, 
  nominal_salary, gross_salary, net_salary, job_title, 
  salary_grade, salary_stage,
  marital_allowance, children_allowance, transport_allowance
) 
select 
  id, 
  920000, 1350000, 1280000, 'رئيس مبرمجين',
  'الثانية', '3',
  50000, 20000, 30000
from public.app_users where username = 'user2';
