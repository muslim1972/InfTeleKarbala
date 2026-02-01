-- Add first_appointment_date to administrative_summary
ALTER TABLE administrative_summary ADD COLUMN IF NOT EXISTS first_appointment_date DATE;

-- Function to get lifetime leave usage from details
CREATE OR REPLACE FUNCTION get_lifetime_leaves_usage(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    reg_days INTEGER;
    sick_days INTEGER;
    result JSONB;
BEGIN
    -- Sum regular leaves
    SELECT COALESCE(SUM(duration), 0) INTO reg_days
    FROM leaves_details
    WHERE user_id = target_user_id AND leave_type = 'اعتيادية';

    -- Sum sick leaves
    SELECT COALESCE(SUM(duration), 0) INTO sick_days
    FROM leaves_details
    WHERE user_id = target_user_id AND leave_type = 'مرضية';

    result := jsonb_build_object(
        'total_regular_days', reg_days,
        'total_sick_days', sick_days
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
