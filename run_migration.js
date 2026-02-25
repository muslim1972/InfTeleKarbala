import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        const sql = fs.readFileSync('d:\\InfTeleKarbala\\supabase\\migrations\\20260225_add_leave_modifications.sql', 'utf8');

        // We cannot run raw SQL string directly via supabase-js easily unless we use an RPC designed for it.
        // However, I can create the migration using the Supabase REST API or just ask the user to run it in Supabase SQL editor.
    } catch (err) {
        console.error(err);
    }
}

runMigration();
