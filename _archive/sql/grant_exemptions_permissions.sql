-- Grant permissions on employee_weekly_exemptions
GRANT ALL ON TABLE public.employee_weekly_exemptions TO authenticated, service_role;
GRANT SELECT ON TABLE public.employee_weekly_exemptions TO anon;
