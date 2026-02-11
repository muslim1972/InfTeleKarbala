
import { supabase } from './utils/db.js';

async function checkCounts() {
    console.log('🔍 Checking Table Counts...');

    const tables = ['profiles', 'financial_records', 'administrative_summary', 'yearly_records'];

    for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error) console.error(`❌ ${t}: Error ${error.message}`);
        else console.log(`✅ ${t}: ${count} rows`);
    }

    // Check Auth Users
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
    // This only gives page, but total is in metadata usually not available easily via simple list without iterating or using specific endpoint?
    // Actually listUsers returns `total`? No, it returns { users, aud }. 
    // We can't easily get total auth users without pagination loop, but let's check if we have at least some.
    if (authErr) console.error('❌ Auth: Error', authErr);
    else console.log(`✅ Auth Users (Page 1 detection): ${users.length > 0 ? 'Exists' : 'Empty'}`);
}

checkCounts();
