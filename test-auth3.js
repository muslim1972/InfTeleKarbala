import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log('--- محاولة جلب المستخدم عبر SQL المباشر ---');

    // Since we have service role key, we can create an RPC to execute raw SQL, but we don't have one ready.
    // Instead, let's try to update a missing field if we assume one. Is `is_sso_user` required? `is_anonymous`?

    // Create a minimal function to read raw auth.users data
    const { error: fnErr } = await supabase.rpc('rpc_sync_user_auth', {
        p_user_id: '1ac7fbfa-48ce-4884-a83c-738f70846cdb',
        p_email: 'dummy@test.com',
        p_password: 'dummy'
    }); // This will fail if something is wrong.

    console.log('rpc call complete');
}

run().catch(console.error);
