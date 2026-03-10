import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
    console.log('--- Checking Function: submit_leave_request ---');
    const { data, error } = await supabase.rpc('inspect_function', { function_name: 'submit_leave_request' });

    if (error) {
        // If 'inspect_function' doesn't exist, try getting it via raw SQL if possible, 
        // but since we only have RPC, let's try a different approach.
        // Usually we can't run arbitrary SQL via RPC unless a helper exists.
        console.error('Error calling inspect_function:', error.message);

        console.log('\nTrying to get column info for leave_requests instead...');
        const { data: cols, error: colError } = await supabase.from('leave_requests').select('*').limit(1);
        if (colError) console.error(colError);
        else console.log('Columns in leave_requests:', Object.keys(cols[0] || {}).join(', '));

    } else {
        console.log('Function Definition:', data);
    }
}

checkFunction();
