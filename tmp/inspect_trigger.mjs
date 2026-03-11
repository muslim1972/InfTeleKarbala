
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

async function getTriggerDef() {
    // If we have a generic 'execute_sql' RPC (often used during development)
    const { data, error } = await supabase.rpc('execute_sql', { 
        sql_query: "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'calculate_financial_totals';" 
    });

    if (error) {
        console.error('RPC Error:', error.message);
    } else {
        console.log('Function Definition from DB:');
        console.log(data);
    }
}

getTriggerDef();
