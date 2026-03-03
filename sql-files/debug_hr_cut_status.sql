-- Script to diagnose why HR cut requests aren't showing up
-- Selecting the relevant columns for all approved requests to see their exact internal state
SELECT 
    id,
    user_id,
    start_date,
    end_date,
    days_count,
    status,
    leave_status,
    cancellation_status,
    cut_status,
    hr_cut_status,
    modification_type,
    cut_date
FROM 
    public.leave_requests
WHERE 
    status = 'approved';
