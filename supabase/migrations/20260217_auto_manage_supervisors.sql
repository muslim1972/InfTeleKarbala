-- Function to automatically manage Supervisors Group membership
CREATE OR REPLACE FUNCTION public.manage_supervisors_group_members()
RETURNS TRIGGER AS $$
DECLARE
  group_id UUID;
BEGIN
  -- 1. Find or Create the 'Supervisors Group'
  SELECT id INTO group_id FROM public.conversations WHERE name = 'مجموعة المشرفين' AND is_group = true LIMIT 1;
  
  IF group_id IS NULL THEN
    INSERT INTO public.conversations (name, is_group, participants)
    VALUES ('مجموعة المشرفين', true, '[]'::jsonb)
    RETURNING id INTO group_id;
  END IF;

  -- 2. Handle Insert or Role Change
  -- Case A: User is now an Admin (Standard, Super, Manager, etc.) -> ADD to group
  IF NEW.role != 'user' THEN
    UPDATE public.conversations
    SET participants = (
      SELECT jsonb_agg(DISTINCT elem)
      FROM jsonb_array_elements_text(participants || to_jsonb(NEW.id)::jsonb) elem
    )
    WHERE id = group_id;
  END IF;

  -- Case B: User became a 'user' (Demoted) -> REMOVE from group
  IF NEW.role = 'user' AND (TG_OP = 'UPDATE' AND OLD.role != 'user') THEN
    UPDATE public.conversations
    SET participants = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements_text(participants) elem
        WHERE elem != NEW.id::text
    )
    WHERE id = group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;

CREATE TRIGGER on_profile_role_change
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.manage_supervisors_group_members();

-- One-time sync for existing users
DO $$
DECLARE
  group_id UUID;
  admin_ids JSONB;
BEGIN
  -- Find/Create Group
  SELECT id INTO group_id FROM public.conversations WHERE name = 'مجموعة المشرفين' AND is_group = true LIMIT 1;
  IF group_id IS NULL THEN
    INSERT INTO public.conversations (name, is_group, participants)
    VALUES ('مجموعة المشرفين', true, '[]'::jsonb)
    RETURNING id INTO group_id;
  END IF;

  -- Get all current non-user IDs
  SELECT jsonb_agg(id) INTO admin_ids FROM public.profiles WHERE role != 'user';

  -- Update the group participants
  IF admin_ids IS NOT NULL THEN
    UPDATE public.conversations
    SET participants = (
      SELECT jsonb_agg(DISTINCT elem)
      FROM jsonb_array_elements_text(COALESCE(participants, '[]'::jsonb) || admin_ids) elem
    )
    WHERE id = group_id;
  END IF;
END $$;
