
-- Add missing IBAN column to profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS iban character varying(50);
