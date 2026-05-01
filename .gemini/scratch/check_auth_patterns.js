
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMoreUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (users) {
    console.log("Sample Auth Emails:");
    users.slice(0, 10).forEach(u => console.log(`- ${u.email}`));
  }
}

checkMoreUsers();
