import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load directly from .env and .env.local
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('departments').select('count');
    console.log('Error:', error);
    console.log('Data:', data?.length);

    const { data: rows } = await supabase.from('departments').select('*').limit(5);
    console.log('Rows:', rows);
}

check();
