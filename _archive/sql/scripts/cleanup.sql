DO $do
BEGIN
    -- 1. Mark 'leave_hr' and biometric alerts as read for Finance admins
    UPDATE system_notifications sn
    SET is_read = true
    FROM profiles p
    WHERE sn.recipient_id = p.id
      AND p.admin_role = 'finance'
      AND sn.type IN ('leave_hr', 'device_mismatch', 'system')
      AND sn.is_read = false;

    -- 2. Clean up cross-governorate biometric/HR notifications
    -- This relies on metadata containing employee_id
    UPDATE system_notifications sn
    SET is_read = true
    FROM profiles recip, profiles emp
    WHERE sn.recipient_id = recip.id
      AND (sn.metadata->>'employee_id') = emp.id::text
      AND recip.governorate != emp.governorate
      AND sn.is_read = false;
      
    RAISE NOTICE 'Old notifications cleaned up.';
END $do;
