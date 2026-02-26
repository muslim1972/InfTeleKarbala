-- 1. Add full_name column if it doesn't exist
ALTER TABLE public.financial_records 
ADD COLUMN IF NOT EXISTS full_name text;

-- 2. Populate full_name from profiles
UPDATE public.financial_records fr
SET full_name = p.full_name
FROM public.profiles p
WHERE fr.user_id = p.id
AND fr.full_name IS NULL;

-- 3. Create Function to Sync Name Changes
CREATE OR REPLACE FUNCTION public.sync_financial_fullname()
RETURNS TRIGGER AS $$
BEGIN
  -- Update financial_records when profiles.full_name changes
  UPDATE public.financial_records
  SET full_name = NEW.full_name
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger on profiles table
DROP TRIGGER IF EXISTS trg_sync_financial_fullname ON public.profiles;

CREATE TRIGGER trg_sync_financial_fullname
AFTER UPDATE OF full_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_financial_fullname();

-- 5. Create Index for faster lookups by name (Since we will use it for Excel matching)
CREATE INDEX IF NOT EXISTS idx_financial_records_full_name ON public.financial_records(full_name);
