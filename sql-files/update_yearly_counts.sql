-- Function to update yearly_records counts automatically
-- Triggered by INSERT/UPDATE/DELETE on details tables

-- 0. Ensure Unique Constraint exists for Upsert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'yearly_records_user_year_key') THEN
        ALTER TABLE public.yearly_records ADD CONSTRAINT yearly_records_user_year_key UNIQUE (user_id, year);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint might already exist or duplicates prevent creation. Please ensure (user_id, year) is unique.';
END $$;

CREATE OR REPLACE FUNCTION public.update_yearly_records_counts()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id uuid;
    target_year int;
BEGIN
    -- Determine user_id and year based on operation
    IF (TG_OP = 'DELETE') THEN
        target_user_id := OLD.user_id;
        target_year := OLD.year;
    ELSE
        target_user_id := NEW.user_id;
        target_year := NEW.year;
    END IF;

    -- Ensure year and user_id are present
    IF target_user_id IS NULL OR target_year IS NULL THEN
        RETURN NULL;
    END IF;

    -- Perform Upsert on yearly_records with recalculated counts
    INSERT INTO public.yearly_records (
        user_id, 
        year, 
        thanks_books_count, 
        committees_count, 
        penalties_count, 
        leaves_taken, 
        updated_at
    )
    SELECT 
        target_user_id,
        target_year,
        (SELECT count(*) FROM public.thanks_details WHERE user_id = target_user_id AND year = target_year),
        (SELECT count(*) FROM public.committees_details WHERE user_id = target_user_id AND year = target_year),
        (SELECT count(*) FROM public.penalties_details WHERE user_id = target_user_id AND year = target_year),
        (SELECT COALESCE(SUM(duration), 0) FROM public.leaves_details WHERE user_id = target_user_id AND year = target_year),
        NOW()
    ON CONFLICT (user_id, year)
    DO UPDATE SET
        thanks_books_count = EXCLUDED.thanks_books_count,
        committees_count = EXCLUDED.committees_count,
        penalties_count = EXCLUDED.penalties_count,
        leaves_taken = EXCLUDED.leaves_taken,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if any to avoid duplication
DROP TRIGGER IF EXISTS trg_update_yearly_thanks ON public.thanks_details;
DROP TRIGGER IF EXISTS trg_update_yearly_committees ON public.committees_details;
DROP TRIGGER IF EXISTS trg_update_yearly_penalties ON public.penalties_details;
DROP TRIGGER IF EXISTS trg_update_yearly_leaves ON public.leaves_details;

-- Create Triggers
CREATE TRIGGER trg_update_yearly_thanks
AFTER INSERT OR UPDATE OR DELETE ON public.thanks_details
FOR EACH ROW EXECUTE FUNCTION public.update_yearly_records_counts();

CREATE TRIGGER trg_update_yearly_committees
AFTER INSERT OR UPDATE OR DELETE ON public.committees_details
FOR EACH ROW EXECUTE FUNCTION public.update_yearly_records_counts();

CREATE TRIGGER trg_update_yearly_penalties
AFTER INSERT OR UPDATE OR DELETE ON public.penalties_details
FOR EACH ROW EXECUTE FUNCTION public.update_yearly_records_counts();

CREATE TRIGGER trg_update_yearly_leaves
AFTER INSERT OR UPDATE OR DELETE ON public.leaves_details
FOR EACH ROW EXECUTE FUNCTION public.update_yearly_records_counts();
