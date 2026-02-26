-- Create leaves_details table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.leaves_details (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leaves_details ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own leaves details" 
ON public.leaves_details FOR SELECT 
USING (auth.uid() = user_id);

-- Optional: Allow inserting if valid (handled by trigger usually, but good to have constraint)
