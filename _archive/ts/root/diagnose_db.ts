
import { createClient } from '@supabase/supabase-base';

// Mocking environment for diagnostic
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking messages table schema...');
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching messages:', error.message);
    } else {
        console.log('Message sample columns:', Object.keys(data[0] || {}));
        if (data[0] && 'buzz_count' in data[0]) {
            console.log('SUCCESS: buzz_count column exists!');
        } else {
            console.log('FAILURE: buzz_count column MISSING!');
        }
    }
}

checkSchema();
