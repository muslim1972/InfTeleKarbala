
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deepInspect() {
  // Try to find all tables by querying information_schema.columns (if exposed via RPC or REST)
  // Since we don't have exec_sql, we'll try a common trick: query a table that might have a join or metadata
  
  // Let's try to query 'available_profiles' again but check ALL rows for any email
  console.log("Checking available_profiles for any email pattern...");
  const { data: avRows } = await supabase.from('available_profiles').select('*').limit(100);
  if (avRows) {
    avRows.forEach(r => {
      const str = JSON.stringify(r);
      if (str.includes('@')) console.log(`Found email in available_profiles row:`, r);
    });
  }

  // Let's try to find if there's a table called 'auth_mapping'
  const { data: mapping } = await supabase.from('auth_mapping').select('*').limit(1).catch(()=>({data:null}));
  if (mapping) console.log("Found auth_mapping table!");

  // Final check: look at the Auth users and see if their 'id' matches any 'id' in a table other than profiles
  const { data: { users } } = await supabase.auth.admin.listUsers();
  if (users && users.length > 0) {
    const testId = users[0].id;
    console.log(`Checking if Auth User ID ${testId} exists in other tables...`);
    const tables = ['profiles', 'app_users', 'users', 'accounts', 'login_info', 'credentials'];
    for (const t of tables) {
      const { data } = await supabase.from(t).select('id').eq('id', testId).maybeSingle().catch(()=>({data:null}));
      if (data) console.log(`Found ID in table: ${t}`);
    }
  }
}

deepInspect();
