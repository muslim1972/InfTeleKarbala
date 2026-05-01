
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  console.log("--- Listing all tables in 'public' schema ---");
  // We'll try to use a common trick: query pg_catalog if exposed, or just use the RPC if it works
  const { data, error } = await supabase.rpc('inspect_function', { func_name: 'is_admin' }); // Check if inspect exists
  
  // Since we can't easily list tables, let's look at the 'available_profiles' view content again.
  // Maybe there is a hidden column?
  const { data: av, error: avErr } = await supabase.from('available_profiles').select('*').limit(1);
  if (av) console.log("available_profiles sample:", av[0]);

  // Let's try to query 'app_users' again but specifically
  const { data: au, error: auErr } = await supabase.from('app_users').select('*').limit(1);
  if (!auErr) console.log("app_users exists! Sample:", au[0]);
  else console.log("app_users does not exist or error:", auErr.message);

  // Check 'login_logs'
  const { data: ll, error: llErr } = await supabase.from('login_logs').select('*').limit(1);
  if (!llErr) console.log("login_logs sample:", ll[0]);
}

listTables();
