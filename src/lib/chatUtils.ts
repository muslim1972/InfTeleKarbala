import { supabase } from '../lib/supabase';

export async function getOrCreateSupervisorsGroup() {
    try {
        // 1. Check if group exists
        const { data: existingGroups, error: fetchError } = await supabase
            .from('conversations')
            .select('*')
            .eq('is_group', true)
            .eq('name', 'مجموعة المشرفين') // Or "Supervisors"
            .limit(1);

        if (fetchError) throw fetchError;

        if (existingGroups && existingGroups.length > 0) {
            return existingGroups[0];
        }

        // 2. Create if not exists
        const { data: newGroup, error: createError } = await supabase
            .from('conversations')
            .insert({
                name: 'مجموعة المشرفين',
                is_group: true,
                participants: [], // Participants will be added via logic or triggers
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) throw createError;

        return newGroup;
    } catch (error) {
        console.error('Error in getOrCreateSupervisorsGroup:', error);
        return null;
    }
}
