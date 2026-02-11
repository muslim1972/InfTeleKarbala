
import { supabase } from './utils/db.js';

async function debugProfiles() {
    console.log('🔍 Debugging Profiles...');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample Row:', data[0]);
}

debugProfiles();
