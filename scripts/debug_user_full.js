
import { supabase } from './utils/db.js';

async function debugUser() {
    console.log('🔍 Debugging User: هاشم جواد كاظم عاكول');

    // 1. Get Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('job_number', '267623') // From previous output
        .single();

    if (!profile) {
        console.error('❌ Profile not found!');
        return;
    }

    console.log(`✅ Profile Found:`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   Card: ${profile.card_number}`);
    console.log(`   Job: ${profile.job_number}`);

    // 2. Check Financials
    const { data: financial, error: finErr } = await supabase
        .from('financial_records')
        .select('*')
        .eq('user_id', profile.id);

    if (finErr) console.error(finErr);

    if (financial && financial.length > 0) {
        console.log(`✅ Financial Record Found (Count: ${financial.length})`);
        console.log(financial[0]);
    } else {
        console.log(`❌ No Financial Record found for UserID: ${profile.id}`);

        // Debug: Dump all financial records user_ids to see if any match partial
        const { data: allFin } = await supabase.from('financial_records').select('user_id').limit(5);
        console.log('Sample Financial UserIDs:', allFin);
    }

    // 3. Check Leaves
    const { data: leaves } = await supabase
        .from('administrative_summary')
        .select('*')
        .eq('user_id', profile.id);

    if (leaves && leaves.length > 0) {
        console.log(`✅ Leaves Record Found: Balance ${leaves[0].remaining_leave_balance}`);
    } else {
        console.log(`❌ No Leaves Record found.`);
    }
}

debugUser();
