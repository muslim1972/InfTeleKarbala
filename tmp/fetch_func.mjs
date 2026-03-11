
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envContent.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabaseUrl = env['VITE_SUPABASE_URL']?.trim();
const supabaseKey = env['VITE_SUPABASE_ANON_KEY']?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchFunction() {
    // Note: To fetch function definitions, we usually need to query pg_proc
    // This requires a custom RPC or a raw SQL query if the anon key has permissions (unlikely)
    // We'll try a simple query to see if we can get anything or if we have another way
    
    console.log('Fetching function definition for calculate_financial_totals...');
    
    const { data, error } = await supabase.rpc('get_function_def', { func_name: 'calculate_financial_totals' });
    
    if (error) {
        console.error('Error (Expected if get_function_def is missing):', error.message);
        console.log('Trying manual investigation of columns instead...');
    } else {
        console.log('Function Definition:');
        console.log(data);
    }
}

fetchFunction();
