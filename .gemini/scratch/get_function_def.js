
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const query = `
    SELECT 
      p.proname as name,
      pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'get_login_profile';
  `;

  try {
    // We try to use a common RPC if it exists, otherwise we're stuck unless we can run raw SQL
    // Let's check if 'exec_sql' exists (common in some projects I worked on)
    const { data, error } = await supabase.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error("Error executing query:", error);
      
      // If exec_sql doesn't exist, let's try to query information_schema or similar via regular table queries if possible
      // But Supabase doesn't allow that easily. 
      // Let's try to find if there's any other way.
    } else {
      console.log("Function Definition:");
      console.log(data);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();
