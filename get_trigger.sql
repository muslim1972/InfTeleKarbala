SELECT action_timing, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'profiles' AND trigger_name = 'on_profile_updated';
