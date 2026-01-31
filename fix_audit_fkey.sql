-- Fix     Foreign Key Constraints for Audit Columns
-- The frontend uses app_users.id, so the FK must reference public.app_users, not auth.users.

-- 1. Thanks Details
ALTER TABLE public.thanks_details DROP CONSTRAINT IF EXISTS thanks_details_last_modified_by_fkey;
ALTER TABLE public.thanks_details 
    ADD CONSTRAINT thanks_details_last_modified_by_fkey 
    FOREIGN KEY (last_modified_by) REFERENCES public.app_users(id);

-- 2. Committees Details
ALTER TABLE public.committees_details DROP CONSTRAINT IF EXISTS committees_details_last_modified_by_fkey;
ALTER TABLE public.committees_details 
    ADD CONSTRAINT committees_details_last_modified_by_fkey 
    FOREIGN KEY (last_modified_by) REFERENCES public.app_users(id);

-- 3. Penalties Details
ALTER TABLE public.penalties_details DROP CONSTRAINT IF EXISTS penalties_details_last_modified_by_fkey;
ALTER TABLE public.penalties_details 
    ADD CONSTRAINT penalties_details_last_modified_by_fkey 
    FOREIGN KEY (last_modified_by) REFERENCES public.app_users(id);

-- 4. Leaves Details
ALTER TABLE public.leaves_details DROP CONSTRAINT IF EXISTS leaves_details_last_modified_by_fkey;
ALTER TABLE public.leaves_details 
    ADD CONSTRAINT leaves_details_last_modified_by_fkey 
    FOREIGN KEY (last_modified_by) REFERENCES public.app_users(id);
