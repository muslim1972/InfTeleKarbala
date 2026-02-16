import { supabase } from '../lib/supabase';

export async function getOrCreateSupervisorsGroup() {
    try {
        const { data, error } = await supabase.rpc('get_or_create_supervisors_chat');

        if (error) throw error;

        return data; // Returns { id: "..." }
    } catch (error) {
        console.error('Error in getOrCreateSupervisorsGroup:', error);
        return null;
    }
}
