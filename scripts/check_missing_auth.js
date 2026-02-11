
import { supabase } from './utils/db.js';

async function checkMissing() {
    console.log('🔍 Checking for profiles with missing Auth data...');

    // 1. Fetch profiles with missing username
    const { data: missing, error } = await supabase
        .from('profiles')
        .select('id, full_name, card_number, job_number')
        .is('username', null);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (missing.length === 0) {
        console.log('✅ No profiles missing auth data within the expected set.');
        return;
    }

    console.log(`⚠️ Found ${missing.length} profiles without username/password:`);
    missing.forEach(p => {
        console.log(`   - ${p.full_name} (Card: ${p.card_number || 'N/A'}, Job: ${p.job_number})`);
    });

    console.log('\nPossible reasons:');
    console.log('1. These employees are not in the Salary Excel file.');
    console.log('2. They have no Card Number mapped in DB, so we could not link them.');
    console.log('3. Their Card Number in Excel is formatted differently.');
}

checkMissing();
