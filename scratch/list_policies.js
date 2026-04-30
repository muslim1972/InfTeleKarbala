import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function listPolicies() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `SELECT tablename, policyname, permissive, roles, cmd, qual 
          FROM pg_policies 
          WHERE schemaname = 'public' 
            AND tablename IN ('profiles', 'departments', 'calls', 'rate_limits')
          ORDER BY tablename, policyname`
  });

  if (error) {
    // If RPC doesn't exist, try direct query via REST
    console.log('RPC not available, trying alternative...');
    
    // Use service role to query pg_policies via SQL
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Alternative failed too. Please run this SQL in Supabase SQL Editor:');
    console.log(`
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'departments', 'calls', 'rate_limits')
ORDER BY tablename, policyname;
    `);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

listPolicies();
