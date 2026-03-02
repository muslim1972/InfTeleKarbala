import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Run from project root (d:\InfTeleKarbala)
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim();
    }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Could not load supabase credentials from", envPath);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    console.log("=== Database Schema Check for Leave Requests Workflow ===");

    console.log("\n1. Checking 'leave_requests' columns:");
    const { data: leaves, error: err1 } = await supabase.from('leave_requests').select('*').limit(1);
    if (err1) console.error(err1.message);
    else if (leaves && leaves.length > 0) console.log(Object.keys(leaves[0]).join(', '));
    else console.log("Table is empty.");

    const { error: err1b } = await supabase.from('leave_requests').select('supervisor_id').limit(1);
    if (err1b) console.error("--> supervisor_id query error:", err1b.message);
    else console.log("--> supervisor_id exists in empty/non-empty table.");

    console.log("\n2. Checking 'profiles' columns:");
    const { data: profiles, error: err2 } = await supabase.from('profiles').select('*').limit(1);
    if (err2) console.error(err2.message);
    else if (profiles && profiles.length > 0) console.log(Object.keys(profiles[0]).join(', '));

    console.log("\n3. Checking 'departments' columns:");
    const { data: depts, error: err3 } = await supabase.from('departments').select('*').limit(1);
    if (err3) console.error(err3.message);
    else if (depts && depts.length > 0) console.log(Object.keys(depts[0]).join(', '));
}

checkSchema();
