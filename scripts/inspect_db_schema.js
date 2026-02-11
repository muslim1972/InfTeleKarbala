
import { supabase } from './utils/db.js';

async function inspectSchema() {
    console.log('🔍 Inspecting DB Schema...');

    const tables = ['financial_records', 'yearly_records', 'profiles'];

    for (const table of tables) {
        console.log(`\n📋 Table: ${table}`);
        // Attempt to fetch 1 record to see keys
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.error(`❌ Error accessing ${table}:`, error.message);
            continue;
        }

        if (data && data.length > 0) {
            const keys = Object.keys(data[0]);
            console.log('✅ Columns found:', keys.join(', '));
        } else {
            console.log('⚠️ Table is empty, cannot infer columns from data. Trying to insert dummy to get schema error? No, risky.');
            console.log('ℹ️ Attempting to verify by empty selection...');
            // If empty, we can't easily see columns via JS client without admin API or specific PostgREST inspection endpoint if enabled.
            // But we can try to rely on previous context or user info.
            // Let's rely on the assumption that the user created tables based on common naming.
            // Or better, check if we have any existing migrations or schema SQL files.
        }
    }
}

inspectSchema();
