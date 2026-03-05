import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    // 1. Find all requests where Bashir is either the requester OR the supervisor
    // Bashir's known ID: 2a24e7bf-357a-4587-9461-8289dfe802dc

    const BASHIR_ID = '2a24e7bf-357a-4587-9461-8289dfe802dc';

    const { data: reqs } = await supabase.from('leave_requests')
        .select('*')
        .or(`user_id.eq.${BASHIR_ID},supervisor_id.eq.${BASHIR_ID}`)
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent requests involving Bashir:");
    reqs?.forEach(r => {
        console.log(`- Request ID: ${r.id} | User: ${r.user_id} | Supervisor: ${r.supervisor_id} | Status: ${r.status}`);
    });

}
run();
