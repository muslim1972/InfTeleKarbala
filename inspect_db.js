import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    // Get columns of leave_requests by selecting one row
    const { data, error } = await supabase.from('leave_requests').select('*').limit(1);
    console.log('--- leave_requests scheme ---');
    if (error) console.error(error);
    else if (data && data.length > 0) {
        console.log(Object.keys(data[0]).join(', '));
    } else {
        console.log('No rows in leave_requests. Cannot infer schema easily.');
    }

    // Get columns of financial_records
    const { data: fin, error: finError } = await supabase.from('financial_records').select('*').limit(1);
    console.log('--- financial_records scheme ---');
    if (finError) console.error(finError);
    else if (fin && fin.length > 0) {
        console.log(Object.keys(fin[0]).join(', '));
    }
}
inspect();
