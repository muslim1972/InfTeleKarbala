-- Add is_anonymous column to poll_responses
-- This allows users to vote anonymously.

BEGIN;

ALTER TABLE poll_responses 
ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;

COMMIT;
