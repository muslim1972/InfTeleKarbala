
import { supabase } from './utils/db.js';

async function debugFinancials() {
    console.log('🔍 Debugging Financial Records...');

    // 1. Count Total
    const { count, error: countErr } = await supabase
        .from('financial_records')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('❌ Error counting financial_records:', countErr.message);
    } else {
        console.log(`✅ Total Financial Records: ${count}`);
    }

    // 2. Fetch one record
    const { data: records, error: fetchErr } = await supabase
        .from('financial_records')
        .select('user_id, nominal_salary')
        .limit(1);

    if (fetchErr) {
        console.error('❌ Error fetching a record:', fetchErr.message);
    } else if (records.length === 0) {
        console.log('⚠️ Table is EMPTY.');
    } else {
        const rec = records[0];
        console.log(`✅ Sample Record UserID: ${rec.user_id}`);

        // 3. Check if this UserID exists in Profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, job_number, card_number')
            .eq('id', rec.user_id)
            .single();

        if (profile) {
            console.log(`   Matches Profile: ${profile.full_name} (Card: ${profile.card_number})`);
        } else {
            console.log(`   ❌ Orphaned Record! UserID not found in Profiles.`);
        }
    }
}

debugFinancials();
