-- Fix user_id foreign key to point to public.profiles to allow embedding
-- Currently it likely points to auth.users, which PostgREST doesn't expose for embedding directly in this context (for profiles)

DO $$
BEGIN
    -- Drop existing constraint if it exists (name might vary, so we try standard names or rely on ID)
    -- We will try to add a second FK or replace it. 
    -- Best practice for Supabase: user_id references auth.users is correct for Auth.
    -- BUT for PostgREST embedding 'profiles', we need a relationship between leave_requests and profiles.
    
    -- Option 1: Add a separate FK constraint to profiles.id (since profiles.id is also a PK)
    -- This allows PostgREST to see the relationship.
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leave_requests_user_id_profiles_fkey' 
        AND table_name = 'leave_requests'
    ) THEN
        ALTER TABLE public.leave_requests 
        ADD CONSTRAINT leave_requests_user_id_profiles_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id);
    END IF;

    -- Also ensure supervisor_id exists and references profiles for better embedding if needed later
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'supervisor_id') THEN
        ALTER TABLE public.leave_requests ADD COLUMN supervisor_id UUID REFERENCES public.profiles(id);
    ELSE
        -- If column exists but FK might be to auth.users, let's add one to profiles too if missing
        -- (Skipping for now to avoid complexity, usually supervisor search uses profiles anyway)
        NULL;
    END IF;

    -- Force schema cache reload (by notifying pgrst)
    NOTIFY pgrst, 'reload config';
END $$;
