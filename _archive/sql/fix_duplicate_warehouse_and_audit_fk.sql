BEGIN;

-- 1. Drop the foreign key on audit logs that prevents deleting locations
ALTER TABLE public.work_location_audit_logs 
  DROP CONSTRAINT IF EXISTS work_location_audit_logs_location_id_fkey;

-- 2. Migrate employees from duplicate location to real official location (0da575ea-300b-4b24-823d-5478d9ab5f56)
-- Update employees who are not already assigned to the real location
UPDATE public.work_location_employees
SET location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56'
WHERE location_id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64'
  AND employee_id NOT IN (
    SELECT employee_id FROM public.work_location_employees WHERE location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56'
  );

-- Delete any remaining redundant assignments for the duplicate location
DELETE FROM public.work_location_employees 
WHERE location_id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';

-- 3. Migrate kiosk device link from duplicate location to real official location
UPDATE public.kiosk_device_locations
SET work_location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56'
WHERE work_location_id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64'
  AND device_id NOT IN (
    SELECT device_id FROM public.kiosk_device_locations WHERE work_location_id = '0da575ea-300b-4b24-823d-5478d9ab5f56'
  );

DELETE FROM public.kiosk_device_locations
WHERE work_location_id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';

-- Update kiosk device name if it was named after the duplicate
UPDATE public.kiosk_devices
SET name = 'طرفية شعبة المخازن/كربلاء'
WHERE id = '7ae540fb-accc-4c05-883f-b81f14131b60';

-- 4. Delete the duplicate work location (Trigger will now record this DELETE cleanly in work_location_audit_logs)
DELETE FROM public.work_locations 
WHERE id = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';

COMMIT;
