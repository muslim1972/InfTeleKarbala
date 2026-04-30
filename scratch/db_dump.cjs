const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDump() {
    console.log("--- DB DUMP START ---");

    // 1. Check Tables and Columns
    const tables = ['profiles', 'available_profiles', 'financial_records', 'login_logs', 'app_users', 'rate_limits'];
    for (const table of tables) {
        console.log(`\nTable: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`  [ERROR] ${error.message}`);
        } else if (data && data.length > 0) {
            console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
        } else {
            console.log(`  Table exists but is empty.`);
        }
    }

    // 2. We need a way to see RPC definitions and RLS policies.
    // Since we can't run arbitrary SQL via the standard client without an RPC,
    // we will check if an RPC like 'exec_sql' exists or create one if the user allows.
    // However, I'll try to find the definitions in the SQL files first as a fallback.
    
    console.log("\nSearching for RPC definitions in SQL files...");
    // (I've already done some of this, but I'll summarize)

    console.log("\nTesting RPC: get_login_profile('تجريبي 1')");
    const { data: lp, error: lpErr } = await supabase.rpc('get_login_profile', { p_username: 'تجريبي 1' });
    console.log("  Result:", JSON.stringify(lp, null, 2));

    console.log("\nTesting RPC: get_own_profile()");
    const { data: op, error: opErr } = await supabase.rpc('get_own_profile');
    console.log("  Result:", JSON.stringify(op, null, 2));

    console.log("\n--- DB DUMP END ---");
}

runDump();
