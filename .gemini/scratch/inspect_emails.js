
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
  console.log("--- Checking Auth Users (to find generated emails) ---");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Auth User List Error:", authError);
  } else {
    console.log(`Found ${users.length} users in Auth.`);
    if (users.length > 0) {
      console.log("Example Auth User:", {
        id: users[0].id,
        email: users[0].email,
        metadata: users[0].user_metadata
      });
    }
  }

  console.log("\n--- Checking for potential tables/views ---");
  // We check 'available_profiles' which we know exists
  const { data: avProf, error: avErr } = await supabase.from('available_profiles').select('*').limit(1);
  if (!avErr && avProf) {
    console.log("available_profiles columns:", Object.keys(avProf[0]));
  }

  // Search for any other interesting tables
  // Since we can't list tables directly without RPC, we'll try common names
  const guesses = ['auth_profiles', 'user_mapping', 'login_data', 'account_info'];
  for (const g of guesses) {
    const { data, error } = await supabase.from(g).select('*').limit(1);
    if (!error) console.log(`Found table: ${g}, columns: ${Object.keys(data[0])}`);
  }
}

inspect();
