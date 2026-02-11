
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'card_number') THEN 
        ALTER TABLE public.profiles ADD COLUMN card_number text; 
        CREATE INDEX IF NOT EXISTS idx_profiles_card_number ON public.profiles(card_number);
    END IF; 

    -- Also verify job_title and department exist as we decided to not add them in Phase 1 initially but might be good now?
    -- No, let's stick to solving the linking issue first.
END $$;
