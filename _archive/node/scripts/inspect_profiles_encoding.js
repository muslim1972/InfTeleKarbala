
import { supabase } from './utils/db.js';

async function inspect() {
    console.log('🔍 Inspecting Profiles Data (Encoding Check)...');

    // 1. Fetch first 20 profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('job_number, full_name, card_number')
        .limit(20);

    if (error) {
        console.error('❌ DB Error:', error.message);
        return;
    }

    console.log(`✅ Loaded ${profiles.length} profiles.`);
    console.log('--- Sample Data ---');
    profiles.forEach(p => {
        console.log(`[${p.job_number}] Card:${p.card_number} Name: ${p.full_name}`);
    });

    // 2. Try to exact search for "مسلم"
    console.log('\n--- Searching for "مسلم" ---');
    const { data: searchResults } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%مسلم%'); // ilike for case-insensitive (though Arabic doesn't have casing, good practice)

    if (searchResults && searchResults.length > 0) {
        console.log(`✅ Found ${searchResults.length} matches for "مسلم":`);
        searchResults.forEach(p => console.log(`   - ${p.full_name} (${p.job_number})`));
    } else {
        console.log('❌ No matches found for "مسلم" using ilike search.');
    }
}

inspect();
