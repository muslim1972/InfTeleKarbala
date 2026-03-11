
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load env from .env or .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const [key, ...parts] = line.split('=');
    if (key && parts.length > 0) {
        env[key.trim()] = parts.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL']?.trim();
const supabaseKey = env['VITE_SUPABASE_ANON_KEY']?.trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFinancials() {
    const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', '%مسلم عقيل%')
        .single();

    if (userError || !user) {
        console.error('User not found:', userError);
        return;
    }

    console.log(`User Found: ${user.full_name} (${user.id})`);

    const { data: fin, error: finError } = await supabase
        .from('financial_records')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (finError || !fin) {
        console.error('Financial record not found:', finError);
        return;
    }

    console.log('\n--- Financial Record Columns ---');
    Object.keys(fin).forEach(key => {
        if (typeof fin[key] === 'number') {
            console.log(`${key}: ${fin[key].toLocaleString()}`);
        } else {
            console.log(`${key}: ${fin[key]}`);
        }
    });

    const calculatedDeductions = (fin.tax_deduction_amount || 0) +
        (fin.loan_deduction || 0) +
        (fin.execution_deduction || 0) +
        (fin.retirement_deduction || 0) +
        (fin.school_stamp_deduction || 0) +
        (fin.social_security_deduction || 0) +
        (fin.other_deductions || 0);

    console.log('\n--- Calculated vs Stored Total Deductions ---');
    console.log(`Sum of components: ${calculatedDeductions.toLocaleString()}`);
    console.log(`Stored total_deductions: ${fin.total_deductions.toLocaleString()}`);
    console.log(`Difference: ${(fin.total_deductions - calculatedDeductions).toLocaleString()}`);
}

debugFinancials();
