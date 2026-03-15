const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('Fetching modify_leave_request definition...');
    const { data, error } = await supabase.rpc('rpc_execute_query', {
        query: "SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'modify_leave_request';"
    });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('--- FUNCTION DEFINITION ---');
        console.log(data[0].routine_definition);
        console.log('--- END ---');
    } else {
        console.log('Function not found.');
    }
}

run();
