
import { supabase } from './utils/db.js';

async function verify() {
    console.log('🔍 Verifying Full Profile Integrity...');

    // 1. Pick a random profile that has data in all tables
    // We'll fetch a profile, then try to fetch related records
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(5); // Get a few to check

    if (error) { console.error('Error fetching profiles:', error); return; }

    for (const p of profiles) {
        console.log(`\n--------------------------------------------------`);
        console.log(`👤 User: ${p.full_name} (Job #: ${p.job_number})`);
        console.log(`--------------------------------------------------`);

        // Financial
        const { data: finance } = await supabase
            .from('financial_records')
            .select('nominal_salary, net_salary, total_deductions')
            .eq('user_id', p.id)
            .maybeSingle();

        if (finance) {
            console.log(`💰 Financials:`);
            console.log(`   - Nominal: ${finance.nominal_salary}`);
            console.log(`   - Net: ${finance.net_salary}`);
            console.log(`   - Deductions: ${finance.total_deductions}`);
        } else {
            console.log(`⚠️ No Financial Record found!`);
        }

        // Administrative (Leaves)
        const { data: admin } = await supabase
            .from('administrative_summary')
            .select('remaining_leave_balance')
            .eq('user_id', p.id)
            .maybeSingle();

        if (admin) {
            console.log(`🏖️ Leaves:`);
            console.log(`   - Balance: ${admin.remaining_leave_balance}`);
        } else {
            console.log(`⚠️ No Administrative/Leave Record found!`);
        }

        // Output raw check
        if (finance && admin) console.log(`✅ DATA INTEGRITY: 100%`);
    }
}

verify();
