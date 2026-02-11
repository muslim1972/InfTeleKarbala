
import { supabase } from './utils/db.js';

async function check() {
    console.log('🔍 Checking Card Number for Ibthal...');

    // Loose search for name
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%ابتهال%');

    if (profiles && profiles.length > 0) {
        profiles.forEach(p => {
            console.log(`User: ${p.full_name}, Card: ${p.card_number}`);
        });
    } else {
        console.log('❌ User Ibthal not found in DB.');
    }
}

check();
