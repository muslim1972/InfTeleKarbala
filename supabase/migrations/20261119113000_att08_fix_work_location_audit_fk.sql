-- Migration: 20261119113000_att08_fix_work_location_audit_fk.sql
-- Fix foreign key constraint on work_location_audit_logs that prevented deleting work locations.
-- An audit log table must be able to preserve audit entries of deleted entities without FK violation.

ALTER TABLE public.work_location_audit_logs 
  DROP CONSTRAINT IF EXISTS work_location_audit_logs_location_id_fkey;
