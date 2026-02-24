import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log("Checking field_change_logs table...");
    const { data: logs, error } = await supabase
        .from('field_change_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching logs:", error);
    } else {
        console.log(`Found ${logs.length} recent logs.`);
        console.log(logs.map(l => ({
            table: l.table_name,
            field: l.field_name,
            id: l.record_id,
            new: l.new_value
        })));
    }
}

checkLogs();
